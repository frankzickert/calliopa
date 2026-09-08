# Memory

## Memory

* The `honcho` connection holds an OpenAI API key. Honcho's deriver and dialectic receive it as `LLM_OPENAI_API_KEY` from the credential accessor, never from `.env.dev`.
* `pnpm run dev` decides Honcho's compose profile from whether the key is stored. The application does not mount the Docker socket.

- Calliopa publishes an authenticated external API, so the process that would hold root-equivalent control of the Docker daemon is the same process a remote caller reaches. The cost of not mounting the socket is one restart the first time a key is added, which is a once-per-machine event.
- Honcho stores vectors in Postgres, which is why the `postgres` service carries pgvector; [Application Foundation](../foundation/development-environment.md) holds that image, the collation trap in the tag it must not use, and the profile that keeps the two memory services out of an instance with no key. The `vector` extension is installed in Honcho's own database by its migrations, which is the pgvector swap paying for itself.
- This is the least proven part of the agent layer, and deliberately left so. What lands is a memory service wired correctly — it migrates, it serves, its worker follows it — not a memory behaviour anyone has watched work. Nothing yet reads or writes a memory.

