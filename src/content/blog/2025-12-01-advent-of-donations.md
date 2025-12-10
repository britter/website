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
