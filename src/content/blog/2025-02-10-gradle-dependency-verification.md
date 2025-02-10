---
title: "Enabling Gradle Dependency Verification: A Practical Guide"
description: "Dependency verification is a crucial aspect of maintaining the integrity and security of your software projects. This blog post gives a detailed breakdown of the process that leads to a streamlined and maintainable verification setup."
pubDate: "2025-02-10"
image: "dependency-verification.png"
---

Modern software development increasingly depends on third-party libraries, which introduces potential risks to the software supply chain.
Dependency verification mitigates these risks by ensuring that the dependencies resolved during your build process match the expected versions and are signed by trusted sources.
Without verification, your project could be vulnerable to:

- **Malicious Dependency Injections:** Attackers could inject malicious code by compromising a third-party dependency. This code could be executed at build time on a developers machine, giving the attacker access to sensible locations such as the developers `~/.ssh` or `~/.gpg` directories.
- **Supply Chain Attacks:** A compromised artifact on a package repository could introduce vulnerabilities into your production environment when it's deployed as part of a software release deployment.

To mitigate these risks, Gradle provides the dependency verification feature.
While Gradle’s [documentation on dependency verification](https://docs.gradle.org/current/userguide/dependency_verification.html) is comprehensive, it lacks the description of a process to come up with a verification setup that strikes the balance between security and maintainability.
So in this blog post I'm going to present how we came up with a steamlined verification metadata file for [one of the GradleX projects](https://github.com/gradlex-org/reproducible-builds/blob/main/gradle/verification-metadata.xml).

:::warning
Before you start copy-pasting all the snippets into your dependency verification file, please make sure to read the [Compromises](#compromises-we-made-and-their-implications) section in order to understand the security implications of following this guide.
:::

## Motivation

Our motivation for enabling dependency verification at GradleX stemmed from our decision to activate [Renovate](https://github.com/renovatebot/renovate) for automated dependency updates.
While Renovate is fantastic for keeping dependencies up to date, it also introduces the risk of inadvertently pulling in compromised or malicious updates.

While this may sound like using Renovate requires the use of dependency verification, it really only made us aware of how little we had paid attention before when updating dependencies manually.
So to make it clear: Dependency verification is not a prerequisite for enabling automatic dependency updates.
You should always be paying attention when updating dependencies.
Dependency update automation just multiplies the risks, because dependency updates happen much more timely and ferquently without human supervision.

By enabling dependency verification, we added a safeguard to ensure that updates are still signed by trusted authors.
This provides peace of mind, knowing that even if a dependency is compromised, the absence of valid PGP signatures will cause the build to fail, prompting a deeper investigation.

## Generating the initial Verification Metadata

To generate the initial verification metadata, we ran:

```bash
./gradlew --write-verification-metadata pgp,sha256 --export-keys
```

This command created three files:

1. **gradle/verification-metadata.xml:** Contains checksums and key information for each artifact.
2. **gradle/verification-keyring.keys:** A plaintext file containing the PGP keys.
3. **gradle/verification-keyring.gpg:** A binary format of the keyring.

During the first iteration of enabling dependency verification we focused on getting these files into a state were we could run the build from the commandline without verification errors.

### Choosing a Keyring Format

Since working with binary files in version control is less ideal, we configured Gradle to only use the armored format by adding the following to the `<configuration>` block of the `verification-metadata.xml` file:

```xml
<keyring-format>armored</keyring-format>
```

After this, the `verification-keyring.gpg` file could savely be deleted.

### Disabling Metadata Verification

Next we tried to reduce the amount of artifacts being tracked by the verification metadata file.
By default, Gradle verifies all files it downloads including POM and Gradle module metadata files.[^1]
So all POM and Gradle module metadata files in your dependency tree are tracked in the verification metadata file.
Since these files are not executable code and pose a relatively low risk, we decided not to verify them.
To simplify the verification file, we set:

```xml
<verify-metadata>false</verify-metadata>
```

After that, we removed any entries in the metadata file that referenced `pom` or `module` artifacts.
These are unlikely attack vectors since introducing malicious dependencies in a POM or Gradle module metadata file would at the same time require changes to the binary dependencies that are themselves subject to verification.

[^1]:
    Downloading in this context means "downloaded by dependency resolution."
    If you happen to have a custom task in your build that uses an abitrary Java API to download artifacts—such as the [gradle-download-task](https://github.com/michel-kraemer/gradle-download-task)—you need to handle this seperately.

### Disabling Key Server Requests

Gradle automatically queries key servers for missing keys, which can be slow and unnecessary after the initial setup.
Furthermore, since key servers were not designed for being hammered with requests, they will block you after you've send too many requests in a row.
To disable keyserver queries, we configured:

```xml
<key-servers enabled="false" />
```

### Manually Adding Missing Keys

It’s common for some keys to be missing or for key server requests to time out.
These keys will appear in the `<ignored-keys>` section of your configuration.
Here's how we added them manually:

1. Search for the key ID on a key server, such as [Ubuntu’s keyserver](https://keyserver.ubuntu.com).
2. Download the key file.
3. Append the entire contents of the key file to `verification-keyring.keys`.
4. Remove the corresponding `<ignored-keys>` entry from `verification-metadata.xml`.
5. Re-run the initial verification command to sort and update metadata:
   ```bash
   ./gradlew --write-verification-metadata pgp,sha256 --export-keys
   ```

This will add the newly added key to all artifacts that have been signed by it.
At the same time when regenerating the verification files, Gradle will sort and annotate the keyring, making it reproducible.

After this step we ended up with the result of [gradlex-org/reproducible-builds#21](https://github.com/gradlex-org/reproducible-builds/pull/21).

## Further Cleanup

At this point we had a verification metadata file that was passing `./gradlew build`.
However, more cleanup was required in order to reduce future maintenance.
Our goal now was to have a minimal and clean dependency verification metadata file, where as many dependencies as possible are covered by trusted keys rather than checksums.

### Handling the Gradle Source Distribution

Even after cleaning up the metadata, IntelliJ still failed to synchronize project because it downloaded the Gradle Source Distribution.
We fixed this by adding it as a component in the metadata file with a checksum.

```xml
<component group="gradle" name="gradle" version="8.12">
   <artifact name="gradle-8.12-src.zip">
      <sha256 value="ab815839bf92def809efce22b6a8f62599798ae86e468e23373404abc235ccbf"
            origin="Recovered from services.gradle.org"
            reason="The artifact is not signed"/>
   </artifact>
</component>
```

However, after further inspection we realized that we would have to manually update this each time Renovate updates the Gradle wrapper.
So instead of tracking the Gradle source distribution as an individual artifact, we decided to add a `<trusted-artifact>` with a regex that matches all Gradle source distributions:

```xml
<trusted-artifacts>
   <trust file="^gradle-\d+\.\d+(?:\.\d+)?(?:-(?:rc|milestone)-\d+)?-src\.zip$" regex="true"/>
</trusted-artifacts>
```

This regex will match Gradle release, RC, and milestone versions, which is all we need at GradleX.
Since parsing a regex in your head is difficult, here are some examples that would be accepted:

- gradle-8.12-src.zip
- gradle-10.2.1-src.zip
- gradle-8.12.1-rc-1-src.zip
- gradle-8.13-milestone-1-src.zip
- gradle-9.0-rc-3-src.zip

### Dealing with Sources and Javadoc JARs

The next issue we encountered during project sync were source and javadoc JARs that IntelliJ downloads in order to be able to navigate to the source code of library code, and show documentation.
Given these are not executable code, we configured our verification to trust all source and Javadoc JARs.

```xml
<trusted-artifacts>
    <trust file=".*-javadoc[.]jar" regex="true"/>
    <trust file=".*-sources[.]jar" regex="true"/>
</trusted-artifacts>
```

### Removing Unnecessary Checksums

Each time we manually added a missing keys to our keyring and removed them from the `<ignored-keys>` section, Gradle added that key to the respective `<component>` element while also keeping the checksum for that component.
This is redundant, because verifying a signature is more secure than comparing checksums.[^2]
So if a PGP key was present for an artifact, we removed the Gradle-generated checksums.

[^2]: This is because checksums only confirm **integrity** (the artifact has not been altered), while signatures confirm both integrity and **authenticity** (it was produced by a trusted source).

**EDIT:** I need to make a correction here as [Cédric Champeau pointed out](https://www.linkedin.com/feed/update/urn:li:activity:7294644088950194176?commentUrn=urn%3Ali%3Acomment%3A%28activity%3A7294644088950194176%2C7294646893928669188%29&dashCommentUrn=urn%3Ali%3Afsd_comment%3A%287294646893928669188%2Curn%3Ali%3Aactivity%3A7294644088950194176%29):

> Small nitpick, you're saying 'This is redundant, because verifying a signature is more secure than comparing checksums'.
> That isn't so simple.
> They are orthogonal dimensions, and one doesn't replace the other.
> As your footnote mentions, checksums are for integrity, and signatures for authenticity.
> Therefore, you could very well have a signed artifact which is compromised, because a key was stolen.
> So signatures do _not_ include integrity, they just give a reasonable trust in who published an artifact.

### Replacing Component Entries with Trusted Key Entries

Next, if an artifact is signed with a known PGP key, instead of listing it as a component, it can be added as a trusted key.
So we replaced all `<component>` entries meeting that requirement with a `<trusted-key>` entry in the `<configuration>` section, for example we had:

```xml
<component group="com.beust" name="jcommander" version="1.82">
   <artifact name="jcommander-1.82.jar">
      <pgp value="C70B844F002F21F6D2B9C87522E44AC0622B91C3"/>
   </artifact>
</component>
```

...and replaced it with:

```xml
<trusted-key id="C70B844F002F21F6D2B9C87522E44AC0622B91C3"
    group="com.beust" name="jcommander" version="1.82"/>
```

### Deciding on Trust Scope

At this point we had to make a decision about the trust scope for our project.
With teh current configuration in the verification metadata we said "we trust that `com.beust:jcommander:1.82` is safe to use if it was signed by key `C70B844F002F21F6D2B9C87522E44AC0622B91C3`."
But what about the next release of [JCommander](https://jcommander.org)?
We would have to at least update the verification file to cover the next version as well.
Instead we decided that we do not only trust keys if they sign specific releases.
In other words, if somebody created a release for a some component before, we believe it's same to use the next release if it's signed by the same key.
Trusting a key for all versions makes dependency updates easier but introduces a risk if the key is compromised.
For GradleX, trusting keys for all future releases was deemed "secure enough," so we removed the `version` attribute from all `<trusted-key>` elements.
That way, as long as projects continue to use the same signing key, we don't have to touch the verification metadata during dependency updates.

### Verifying Remaining Components

The last step was to deal with the remaining entries in the `<components>` section.
Some of them had a signature but the comment Gradle generated said, that is was unable to retrieve the signing key.
In our case all these artifacts where available on [Maven Central](https://search.maven.org), including their signatures.
We followed the following steps to retrieve the signing key:

1. Download both the JAR and the `.asc` signature file.
2. Run `gpg --verify <artifact>.asc` to extract the signing key.
3. Search for the key online and add it manually if found.
4. Follow the steps from above to move the key to `<trusted-keys>`.

After that two artifacts remained that had not been signed at all.
This is common for plugins from the [Plugin Portal](https://plugins.gradle.org) because it does not enforce signing artifacts before upload.
This unfortunately means that we have to fallback to checksum verification of the individual artifacts, which causes maintenance overhead each time we update that dependency.
For each artifact we did the following:

1. Download the artifact from its repository and compute its SHA256 checksum.
2. Compare the checksum with Gradle’s generated one in the verification metadata file.
3. If manually verified, update the `origin` attribute of the metadata entry to indicate the verification source.

We will have to do this each time in the future when these dependencies are updated because each release will have a different checksum.

Finally, we were happy with the state of dependency verification file after applying these changes via [gradlex-org/reproducible-builds#23](https://github.com/gradlex-org/reproducible-builds/pull/23).

## Compromises we made and their implications

Throughout the process of enabling dependency verification for the GradleX project, we made some compromises in order to make dependency updates more straight forward.
Each compromise comes with implications that I want to explicitly state here again.
It's important to not blindly follow what we did, but make your own decision based on the threat model of your project.
So let's go through the modifications we made, and discuss their implications briefly:

- **Preferring PGP signatures:** Using PGP signatures instead of checksums makes dependency updates more straight forward.
  At the same time it's more secure as long as you have a way of establishing trust with PGP keys.
  There are [different ways](https://en.wikipedia.org/wiki/Key_signing_party) of doing this.
  For us it was good enough to know that a particular key had signed a release in the past.
  This leaves the door open for an attack if that release was already signed by a compromised key.
- **Using only the ASCII-armored keyring:** No implications on security.
- **Disabling metadata verification:** This would allow a malicious actor to inject a POM or Gradle metadata module file into your build.
  Given these files are not executable and they only contain references to other artifacts, it's difficult to think of a way to compromise your project.
  This is because all binary artifacts are covered by verification.
  So even if somebody would find a way to alter a POM file in the dependency graph, and that way add a dependency to a malicious artifact, dependency verification would fail for that artifact.
  Because of this it's important not to blindly accept changes to the metadata file.
  If Renovate proposes a change, you need to make sure it's a legitimate change.
- **Disabling key server requests:** No implications on security.
- **Manually adding missing keys:** Looking up keys on a key server touches on the same point as the first one in this list.
  PGP signing is only good as long as you have a way of establishing trust to the keys that were used to sign artifacts.
- **Trusting all source and javadoc artifacts:** Since these artifacts are not executable, there's little risk.
  The only attack vector I can think of if a clever social engineering attack where somebody injects a JavaDoc JAR, that has a link in some class documentation that when clicked will compromise your computer.
- **Trusting keys for future releases:** This is probably the most severe decision we made.
  Tursting a key to be safe for any release of a component, puts you add risk of a supply chain attack if that key gets compromised.
  If you cannot accept this risk, you need to reverify that the key has not been compromised for each release.

So the bottom line is: security is hard.

## Conclusion

With dependency verification enabled, Gradle ensures dependencies remain signed with expected keys or matching checksums.
Renovate and Dependabot can continue automated updates while maintaining security.
If a dependency update fails due to a key change, confirm with the authors before trusting the new key.
By following these steps, we improved the security and reproducibility of our builds, ensuring that automated dependency updates remain trustworthy while protecting against supply chain attacks.
