---
title: "Reviewmoji: Five Emojis for Effective Code Reviews"
description: "I prefix every code review comment with one of five emojis to signal what response I expect from the author. Here is the convention."
topics: ["Engineering Culture"]
---

I prefix every code review comment with one of five emojis.
The emoji tells the author exactly what response I expect — and what I don't.
Reviewmoji is to [Conventional Comments](https://conventionalcomments.org) what [gitmoji](https://gitmoji.dev) is to [Conventional Commits](https://www.conventionalcommits.org): a visual convention for the same thing.

| Emoji | Shortcode           | Meaning                                                                     |
| ----- | ------------------- | --------------------------------------------------------------------------- |
| ❌    | `:x:`               | This is a bug, a regression, or a real problem. This needs to be addressed. |
| 🅾️    | `:o:`               | A suggestion. I would do this differently — but it's your code, your call.  |
| ❓    | `:question:`        | A genuine question. I would like an answer.                                 |
| 💭    | `:thought_balloon:` | A thought I had reading this. No action expected.                           |
| 💡    | `:bulb:`            | Something I learned from reading this code. No action expected.             |

Only ❌ blocks the merge.
If a review has at least one ❌, I click "Request changes" on GitHub.
If it doesn't, I approve — even if I left a dozen 🅾️, 💭, and 💡 comments along the way.
Everything else is conversation, not a blocker.

The point is to keep code review a safe space to collaborate and learn, not a gauntlet to run.
Submitting code for review means putting imperfect work in front of other people — that takes a bit of courage.
Reviewmoji removes the ambiguity that makes every comment feel like a demand or critique, so the author can engage without bracing for impact.
That's the environment I want, and these five emojis are how I get there.
