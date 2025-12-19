---
title: "Advent of Donations"
description: "I've decided to donate to open source projects for each day of December 2025 until Christmas. This blog post lists the projects donated to."
pubDate: "2025-12-01"
image: "https://imgs.xkcd.com/comics/dependency.png"
---

Ever since I've started a career in software development, I was facinated with open source.
I remember my first days at my first company when somebody told me to always check [Apache Commons](https://commons.apache.org) before developing anything from scratch.
I was stunned by the fact that high quality libraries like this were given away for free!
As I made my journey as a software engineer, open source software has always been a part of it.

Over the past two years, open source software has become even more important to me.
Due to geo-polictial developments I wanted to be less dependend on US big tech.
I replaced my MacBook with a laptop running [NixOS](https://nixos.org) - I use NixOS btw - my iPhone with a Pixel running [GrapheneOS](https://grapheneos.org), flashed [KOReader](https://koreader.rocks) onto my Kindle, and am self-hosting a bunch of services on a home server.
All of this made possible by the passionate work of open source developers around the globe.

In this blog post I'm going to list all the projects that I donate to.
Therefore I will update the post each day with the project of that day.
I hope to inspire others to give something back to the people the keep the software world running.
Feel free to reach out to me via [mastodon](https://chaos.social/@britter) or [LinkedIn](https://www.linkedin.com/in/benedikt-ritter-83847b84/) and let me know if you donated yourself and why.

## Donation guidelines

First of all, how much am I going to donate?
For this year I've decided to give $50 per day per project.
That doesn't sound like much but over 24 days it sums up to $1,200.

I'm also setting myself a few rules to make the selection process easier.
These are not hard rules, but serve as guidelines.
So even if one of the projects does not tick all the boxes, I will donate if it feels right.

- The things I sponsor should have had a direct impact my (work) life in 2025.
- I want to support individuals or small teams because I hope a donation there makes a bigger difference.
- I'm not going to sponsor projects that already have corporate backing or that have questionable sponsor policies.
- Project selection is not limited to projects that produce software. I can see myself donating, e.g. to content creators how create great learning content that I benefit from.
- Last but not least there needs to be a relatively easy way to send money to the project, e.g. via [GitHub sponsors](https://github.com/open-source/sponsors), [Patreon](https://patreon.com), [PayPal](https://paypal.com), or a classical International Bank Account Number (IBAN).

## Donations

I'm going to structure each day with two sections: 1) URL and self-description of the project, and 2) how the project had an impact on me.

### Day 1 - fish

https://fishshell.com

> Finally, a command line shell for the 90s
>
> fish is a smart and user-friendly command line shell for Linux, macOS, and the rest of the family.

fish shell is among the tools in my terminal environment I've used for the longest time.
I learned about it sometime around 2014 at a local meetup in Düsseldorf and was immediately blown away by its history based command completion.
Whatever I do at my computer, it often starts with opening a terminal which then runs fish.
fish is one of these tools that just stays out of your way.
It just works and does what it should.
It does that so good, that most of the time I don't think about the fact that I'm using fish shell.
I only realize when I have to work on a different computer or server and have to fall back to plain old bash.

So the first donation goes to [Johannes Altmanninger](https://github.com/korbelus) who is listed as the receiver of GitHub sponsoring on [fish shell's GitHub repository](https://github.com/fish-shell/fish-shell).

### Day 2 - vaultwarden

https://github.com/dani-garcia/vaultwarden

> Unofficial Bitwarden compatible server written in Rust, formerly known as bitwarden_rs

Using unique, strong passwords everywhere is essential nowadays.
When I started my home lab, I knew that among the first services I wanted to host myself was some sort of password manager.
Vaultwarden is exactly what I needed in order to migrate my and my wife's password safes from [1Password](https://1password.com) into my home lab.
It is compatible to the [Bitwarden](https://bitwarden.com) iOS and Android apps as well as the various Bitwarden browser extensions.
Since I installed it on my home server more than a year ago, I never had to touch it again.
As with fish shell, it simply works.

The donation for day 2 therefore goes to [Daniel García](https://github.com/dani-garcia), maintainer of the Vaultwarden project.

### Day 3 - Codeberg e.V.

https://codeberg.org

> Software development, but free!
>
> Codeberg is a non-profit, community-led effort that provides Git hosting and other services for free and open source projects.

For the past decade [GitHub](https://github.com) has been the de-facto standard code hosting platform for projects of any size.
While there have been alternatives like [GitLab](https://gitlab.com) and [BitBucket](https://bitbucket.org) most of them are corporations in the US.
So putting your code there it will always be subject to changing company strategy and even legislation of foreign counties.
Codeberg is different.
It's a [Forgejo](https://forgejo.org/) instance operated by a non-profit organization in Berlin, Germany.
Forgejo's code is open source, so you know exactly what's happening behind the scenes.
Furthermore you can become a member of Codeberg e.V. for a yearly fee starting at 24€ and become involved in its organization and operations.

For day 3 I've decided to spend 50€ on a Codeberg e.V. membership.

### Day 4 - tree-sitter-alloy

https://github.com/mattsre/tree-sitter-alloy

> Grafana Alloy grammar for tree-sitter

Looking at what I've donated to, this may look like it doesn't fit into the group of high profile projects we've had so far.
But remember the rules of the game: I want to sponsor individuals whose work helped me in 2025 in any way.
[Matt Conway](https://github.com/mattsre) - maintainer of tree-sitter-alloy - is exactly such an individual.
In one of my projects we decided to setup telemetry using [Open Telemetry](https://opentelemetry.io/) with [Grafana Alloy](https://grafana.com/docs/alloy/latest/) as the collector.
So naturally I had to write some Alloy config.
Since Alloy uses a custom configuration language that isn't widely supported yet but editors, the editing experience was pretty bad.
Luckily I found the tree-sitter-alloy grammar, which makes editing Alloy files in [NeoVim](https://neovim.io) and absolute joy.
I even reported an [issue](https://github.com/mattsre/tree-sitter-alloy/issues/2) with highlighting of escaped strings that was fixed within a day.

So Matt Conway will receive my donation of $50 for putting together this project that directly helped me do my job.

### Day 5 - Marco Peluso

https://www.youtube.com/@marco_peluso

> Hi, my name is Marco. Let's get started!

Marco Peluso is a YouTuber dedicated to creating videos about efficient terminal workflows in general and working with vim in particular.
When I decided to go all in on NeoVim at the beginning of the year, I started to absorb any content I could find about how move around and edit quickly without using the mouse.
Around that time I found Marco's channel, and boy has it helped me level up my Vim skills.
Marco takes a very structured approach to teaching Vim by creating short videos about a single feature at a time and explaining it end to end.
I watched most of his videos and can only highly recommend checking the channel out.

Marco helped me improve my Vim skills and therefore will receive today's donation of $50.

### Day 6 - Catppuccin

https://catppuccin.com

> Soothing pastel theme for the high-spirited!
>
> A community-driven color scheme meant for coding, designing, and much more!

I'm the type of developer who needs some eye candy while coding.
After having tried other color schemes including Dracular and Solarized Light, I've been using Catppuccin Macchiato for about two years now.
The Catppuccin project offers a [wide range of ports](https://catppuccin.com/ports/) so you can essentially style your whole desktop with the same color palette.
Moreover for NixOS users, they offer [modules](https://github.com/catppuccin/nix) that automatically style every supported program that's enable in your configuration.
This makes creating a beautiful desktop super easy.

For making me happy everytime I look at my desktop, the Catppuccin project will receive today's donation of $50.

### Day 7 - GrapheneOS

https://grapheneos.org

> The private and secure mobile operating system with Android app compatibility.
> Developed as a non-profit open source project.

As I've already revealed in the introduction of this blog post, I've replaced my iPhone this year with a Pixel 7a running [GrapheneOS](https://grapheneos.org).
GrapheneOS is a privacy-focused mobile operating system build on top of the [Android Open Source Project](https://source.android.com/).
It's one pillar of my quest to get rid of big tech in my life.
People look at their mobile screens tens of times each day and I'm no exception.
GrapheneOS probably belongs to the open source tech that I'm using the most each day.

Donation of day 7 therefore goes to [Daniel Micay](https://github.com/thestinger), developer of GrapheneOS.

### Day 8 - hledger

https://hledger.org

> Robust, fast, intuitive plain text accounting tool with CLI, TUI and web interfaces.

When I started my [self-employment at the beginning of the year](/blog/2024/12/20/hello-world/), I knew that I needed some sort of accounting software.
By chance I came across [plain text accounting](https://plaintextaccounting.org/) - the idea of having all your accounting data inside of plain text files, that can be edited with a simple text editor (read: NeoVim).
hledger is one CLI tool for managing a plain text accounting data base and has made account fun for me (not kidding!).

heldger's developer [Simon Michael](https://github.com/simonmichael) will receive today's donation.

### Day 9 - bat

https://github.com/sharkdp/bat

> A cat(1) clone with wings.

`bat` was among the first programs from the [modern unix](https://github.com/ibraheemdev/modern-unix) list that I used (in fact I think I used it before I knew about that list).
The idea of tools like `bat` and others from the modern unix list is to reimplement / reimagine classical unix command lines tools but with modern features.
Using these tools leads to a more modern and enjoyable experience when using the terminal.
In that spirit, `bat` is a `cat` clone that includes syntax highlighting and git support.
I've aliased it to `cat` and thus use it almost every day.

The donation of day 9 goes to [David Peter](https://github.com/sharkdp/), developer of `bat`.

### Day 10 - chaos.social

https://chaos.social

> chaos.social
>
> Decentralized social media powered by Mastodon

When Twitter went up in flames some time ago, I was looking for a new micro blogging home.
I wanted to try Mastodon but didn't know which [instance](https://joinmastodon.org/servers) to choose.
Somehow I ended up on chaos.social which is operated by a non-profit in Germany.
Since chaos.social is founded soley by donations, it's about time I give something back.

Today I'm donating to [chaos.social e.V.](https://meta.chaos.social/verein), the non-profit operating the chaos.social mastodon instance.

### Day 11 - tmux

https://github.com/tmux/tmux

> tmux is a terminal multiplexer: it enables a number of terminals to be created, accessed, and controlled from a single screen.

Remember when I said, that whatever I do it often starts with opening [fish](#day-1---fish)?
The first command I usually type into a new fish session is `tmux`.
tmux helps me stay focused in my terminal, providing the key bindings I need so I can work without the mouse.
It's one of those foundational tools that I uses every single day.

The donation of day 11 goes to [Nicholas Marriott](https://github.com/nicm) developer of tmux.

### Day 12 - Molly

https://molly.im

> An improved Signal app

As soon as I had migrated from iOS to [GrapheneOS](#day-7---grapheneos) I needed to find alternatives for the apps that I had been using before.
In case of Signal for iOS, there is the normal Signal for Android app, but it requires Google Play services.
I try to avoid installing apps from the Google Play store as much as possible and instead try to use FOSS apps from the [F-Driod store](https://f-droid.org).
That's how I found Molly which is a fork of the original Signal app that works without Google Play services and can be installed via F-Droid.
I've been using it ever since and am super happy with the experience.

Today's donations therefore goes to the Molly project.

### Day 13 - Vimjoyer

https://www.youtube.com/@vimjoyer

Today we have another content creator.
Vimjoyer is a YouTuber dedicated to creating content about NixOS.
His channel played a big role in my NixOS journey and in understanding how things play together.
Vimjoyer's videos are short and to the point and feature nicely animated source code.
If you want to learn NixOS, I can only recommend checking out the channel.

My donation for day 13 goes to Vimjoyer for producing great video content about my favorite operating system.

### Day 14 - Nix Community

https://nix-community.org/

> A project incubator that works in parallel of the [@NixOS](https://github.com/NixOS) org

The Nix Community project fills the gaps that don't fit into the broader NixOS organization.
I use multiple of the Nix Community projects, both on my laptop and on my servers.
This includes [home-manager](https://github.com/nix-community/home-manager), [disko](https://github.com/nix-community/disko), [nixos-anywhere](https://github.com/nix-community/nixos-anywhere), [nixvim](https://github.com/nix-community/nixvim), and more.
Using Nix Community projects makes using NixOS even more pleasant.

The Nix Community project will receive the donation for day 14.

### Day 15 - zoxide

https://github.com/ajeetdsouza/zoxide

> A smarter cd command. Supports all major shells.

I've talked about how my work most of the time begins with opening [fish](#day-1---fish), and that the first command I insert into fish is [tmux](#day-11---tmux).
Once I'm in my tmux session, I typically use zoxide to jump directly to the directory of the project I want to work on.
zoxide keeps a list of all the locations you visit in your terminal and then let's you jump to them without typing in their absolute path.
This speeds up moving around in the terminal tremendously.

For his work on zoxide, [Ajeet D'Souza](https://github.com/ajeetdsouza) will receive today's donation.

### Day 16 - Restic

https://restic.net

> Fast, secure, efficient backup program

I'm hosting a few servies on a home server for almost two years now and it has been great fun.
But at the beginning once I had migrated off Google Docs the fact that I did not have a proper backup gave me sleepless nights.
I started with some bash scripts calling rsync to move stuff to a backup computer but that only got me so far.
That's when I discovered Restic, an amazing tool that creates incremental backups and can store them in various backends including S3-compatible object storage.
Moving my backups to Restic finally gave me peace of mind knowning I can always restore previous versions of all my files.

For providing Restic [Alexander Neumann](https://github.com/f0d) will receive today's donation.

### Day 17 - fzf

https://junegunn.github.io/fzf/

> A command-line fuzzy finder

Once I'm in my [tmux](#day-11---tmux) session inside of [fish](#day-1---fish) and have navigated to my project directory using [zoxide](#day-15---zoxide), I typically start NeoVim using a custom alias called `v`.
The alias uses fzf to start a fuzzy search in the current working directory, using [bat](#day-9---bat) to display file previews.
Once I select a file it will launch NeoVim with that file.
This pretty much concludes my workflow from opening the terminal to opening a file in NeoVim.

[Junegunn Choi](https://github.com/junegunn) will receive today's donation for making fzf.

### Day 18 - KOReader

https://koreader.rocks

> An ebook reader application supporting PDF, DjVu, EPUB, FB2 and many more formats, running on Cervantes, Kindle, Kobo, PocketBook and Android devices

KOReader is another pick from the software I use in order to get rid of big tech as much as I can.
I've had a Kindle for almost a decade and it's my preferred way to consume books.
But using a Kindle naturally means you're locked into Amazon's ecosystem...
Only until you liberate your Kindle by flashing KOReader onto it.
KOReader has so many features, my favorite one being night mode, which will invert the colors so that the screen is mostly black with only the letters being lit in white.

The KOReader team will receive today's donation.

### Day 19 - Astro

https://astro.build

> The web framework for content-driven websites.

At the beginning of the year when I kick-started my self-employment I knew that I needed a new website.
My old website was based on [Jekyll](https://jekyllrb.com/) and hadn't been updated in ages.
A good friend suggested to look into Astro, a JavaScript based static website generator.
At first I was hesitant, because I didn't want to write JavaScript to create a simple website.
But I quickly started enjoying the flexibility and ease of use.
Since then I had to bootstrap two other websites ([gradlex.org](https://gradlex.org), and [testlens.app](https://testlens.app)) both of which I built with Astro.
In my opinion it's the best option available for building static websites at the moment.

For that reason, the Astro team will receive today's donation.
