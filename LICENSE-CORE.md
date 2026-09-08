# Calliopa Core Licence

Version 1.0

## 1. What this covers

This licence covers the **Calliopa Core**: the software written by the Licensor and published
as the Calliopa release binaries — the bootstrap runtime, the Calliopa-Cypher Gateway, the
kernel, and the migration and seed tooling.

It does not cover third-party software. See Section 7.

It does **not** cover the extensions distributed with Calliopa, including the interface
shell, the settings extension, `calliopa-base` and `calliopa-extension`. Those are licensed
under the Apache License, Version 2.0, and you may use, modify and redistribute them on those
terms. See `LICENSE`.

Licensor: Frank Zickert. "You" is the person or organisation exercising the rights below.

## 2. Your right to use it

The Licensor grants You a perpetual, worldwide, royalty-free, non-exclusive right to install
and run the Core for any purpose, including commercial purposes, subject to Section 3.

No fee is payable for this right and it does not expire.

## 3. One distinguishable user

The right in Section 2 permits one instance with **one distinguishable user**. The Core does
not tell one person from another, and under this Section it need not.

You may let any number of people work through that one identity. The Licensor neither
restricts this nor polices it. What You do not get is attribution: nothing in the instance can
record which person proposed a change, accepted one, or held authority over a decision.

Running an instance in which people are distinguishable from one another — so that authority,
provenance and approval are attributable to a named person — requires a separate written
agreement with the Licensor. It is priced per instance. Write to the address in Section 13.

- Nothing in this Section takes effect by disabling anything You already have. An instance
  licensed for distinguishable users and not renewed returns to the terms of Section 2: it
  keeps running, and Your data, content and graph are untouched.

## 4. What you may not do

You may not:

- redistribute, resell, sublicense, rent or lease the Core;
- offer the Core to third parties as a hosted or managed service;
- reverse engineer, decompile or disassemble the Core, except to the extent that this
  restriction is prohibited by applicable law;
- run an instance with more than one distinguishable user without the agreement Section 3
  requires, or circumvent any mechanism the Licensor provides to establish that agreement;
- remove or alter any copyright, licence or attribution notice.

## 5. Everything you make is yours

This section is a term of this licence and not a statement of policy.

- The Licensor claims no right, title or interest in anything You create, store or process
  with the Core. This includes Your content, Your context, Your rules and decisions, Your
  configuration, Your graph, and any extension You write.
- Running the Core grants the Licensor no licence over any of it.
- The Licensor receives none of it.
- Nothing in this licence permits the Licensor to access, inspect, copy or retain anything in
  Your instance.

## 6. The Core does not communicate with the Licensor

This section is a term of this licence and not a statement of policy.

- The Core contains no functionality that transmits information to the Licensor. It sends no
  telemetry, no usage data, no diagnostics, no crash reports, no update checks and no licence
  validation request.
- The Core does open network connections to services **You** configure and control, such as
  the model providers Your agents use and the destinations You publish to. Those connections
  are Yours. None of them reach the Licensor.
- Where the Core produces a diagnostic report, it writes it locally and transmits it nowhere.
  Sending it to the Licensor is Your decision and Your action, taken after You have read it.

## 7. Third-party software is not part of the Core

Calliopa is delivered with a compose file and build recipes that reference container images
published by other people — a database, an object store, an agent runtime, the base operating
system images the recipes build on, and whatever else those files name.

- Those images are pulled by **You**, from their publishers, to Your machine. The Licensor
  does not distribute them, does not redistribute them, and does not include them in the
  Core.
- Each is licensed to You by its own publisher under its own terms. This licence grants You
  nothing in respect of any of them and cannot.
- The Licensor gives no warranty for them, makes no representation about their fitness,
  security or licensing, and accepts no responsibility or liability for them.
- Where the Licensor publishes a build recipe rather than an image, running that recipe is
  Your act. Anything it installs is installed by You, on Your machine, under whatever terms
  govern it — including any agent runtime or command-line tool it obtains, which You are
  responsible for being entitled to use.

* The Licensor's responsibility begins and ends with the Core and the extensions.

## 8. Trademarks

This licence grants no right to use the name "Calliopa", the Calliopa laurel, or any other
mark of the Licensor.

The Apache License covering the extensions likewise grants no trademark right (Apache-2.0,
Section 6). You may fork and distribute the extensions; You must rename before You do.

## 9. Ownership

The Core remains the property of the Licensor. This licence grants a right to use it and
transfers nothing else.

## 10. No warranty

The Core is provided "as is", without warranty of any kind, to the extent permitted by
applicable law.

## 11. Liability

The Licensor provides the Core solely as a general-purpose tool for managing information
through AI agents, "as is" as stated in Section 10. Providing the tool does not mean the
Licensor manages Your information or performs Your agents' work.

You select, add and configure the agents and supply or connect the content they work with.
The Licensor does not control which agents You use, what information You bring into the
system, what instructions or permissions You give the agents, or what You do with the system
or its results.

You are responsible for Your choice and configuration of agents, the content You supply or
make accessible, and Your use of the system. This includes supervising agent activity,
checking outputs before relying on them, and ensuring that Your use of information and
results complies with applicable law and third-party rights.

To the extent permitted by applicable law, the Licensor gives no assurance of the accuracy,
reliability, completeness, lawfulness or suitability of agent actions or outputs, and accepts
no liability for those actions or outputs, for content supplied or processed through the
system, or for Your use of the system or reliance on its results, including any resulting
loss or damage.

Nothing in this Section excludes or limits liability that cannot lawfully be excluded or
limited.

## 12. Termination

This licence terminates automatically if You breach Section 4. On termination You must stop
using the Core. Sections 5, 6, 7, 8, 9, 10 and 11 survive.

## 13. Governing law

German law. Place of jurisdiction is the Licensor's registered seat, to the extent legally
permissible.

Contact: mail@calliopa.com
