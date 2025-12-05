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
