---
title: "Using `immutables.org` with Gradle the Right Way"
description: "Learn how to correctly configure the immutables.org library in a Gradle project using Kotlin DSL. This post covers annotation processor basics, explains why minimal dependencies matter, and shows how to avoid common pitfalls like runtime pollution from unnecessary artifacts."
pubDate: "2025-05-16"
image: "immutables-gradle.png"
---

## Introduction

If you’re working with Java and want to generate immutable value types, [immutables.org](https://immutables.github.io/) is a powerful and widely-used library. It provides annotation-based code generation to help you reduce boilerplate while keeping your code clean and safe.

However, while the official documentation offers a clear setup example for Maven, it falls short when it comes to Gradle. Worse, it recommends using a single `value` artifact with the `provided` scope, which doesn’t translate directly to Gradle — and isn’t ideal in terms of dependency hygiene either.

This post explains how to correctly and minimally configure `immutables` for a Gradle-based project.

## A Quick Recap: Annotation Processors in Java

Annotation processors are tools that run at compile time and generate source code or other resources based on annotations in your code. In the case of `immutables`, they scan for `@Value.Immutable` and generate implementation classes like `ImmutableMyType`.

In Java's build ecosystem:

- You **don't** need annotation processors at runtime.
- The code they generate is compiled along with your own source files.
- Only the generated classes (not the processors) make it into the final build.

This separation is crucial for keeping your build fast and secure.

## Proper Gradle Setup for Immutables (Kotlin DSL)

If you're using the Kotlin DSL (`build.gradle.kts`), here's how you can configure your project with the minimal and correct setup:

```kotlin
dependencies {
    // Only needed at compile time for annotations like @Value.Immutable
    compileOnly("org.immutables:value-annotations:<latest-version>")

    // Used by the compiler to generate immutable implementation classes
    annotationProcessor("org.immutables:value-processor:<latest-version>")
}
```

Replace `<latest-version>` with the latest release of `org.immutables` (you can find it on [Maven Central](https://search.maven.org/search?q=g:org.immutables)).

### Why these artifacts?

- `value-annotations`: Contains only the annotations (like `@Value.Immutable`) — this is all your source code needs to see during compilation.
- `value-processor`: This is the actual annotation processor that generates the code during compilation — it should never be part of your runtime classpath.

:::warning
You **should not** use the `value` artifact (which bundles both annotations and the processor) in Gradle builds, because it unnecessarily pulls the processor into the compile and potentially runtime classpaths.
:::

## Why Minimal Dependencies Matter

Minimizing dependencies is about more than aesthetics — it’s about performance, maintainability, and security.

- **Performance**: Fewer dependencies mean less work for the compiler and faster builds.
- **Security**: Every additional library increases your attack surface. An unused annotation processor sitting on your runtime classpath is a liability.
- **Clarity**: It’s easier to reason about your build when each dependency has a clearly defined purpose and scope.

By properly scoping your dependencies, you ensure that your build is lean and your application is not bloated with unnecessary code or potential vulnerabilities.

:::tip
The [org.gradlex.jvm-dependency-conflict-resolution](https://gradlex.org/jvm-dependency-conflict-resolution) plugin, provides a powerful DSL to fix dependency metadata in order to clean up dependency scopes in your project.
:::

## Summary

Using `immutables` with Gradle doesn’t have to be a guessing game. While the official docs lean Maven-first, a clean Gradle setup is simple and elegant when you understand the role of annotation processors.

To recap:

- Use `compileOnly` for annotations like `@Value.Immutable`.
- Use `annotationProcessor` for the code generator.
- Avoid runtime pollution by keeping these dependencies out of your runtime classpath.

A disciplined approach to build configuration pays dividends in speed, safety, and maintainability. Happy building — and stay immutable.

---

_If you need help optimizing or troubleshooting your Gradle builds, I offer [consulting services](/services/gradle) — feel free to reach out!_
