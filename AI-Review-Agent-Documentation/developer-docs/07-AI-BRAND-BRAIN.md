# AI and Brand Brain

Brand Brain is structured first-party configuration, not a giant freeform prompt. AI pipeline includes language/risk/rules, provider gateway, structured schema validation, promise/hallucination and repetition guards. Sensitive categories force manual review. Editing does not silently train the system; preference learning requires explicit confirmation. UI locale never changes reply language. No LLM receives provider credentials or authorization power.
## Engineering principles
Tenant isolation and authorization are backend concerns. Provider secrets remain server-side. External writes are idempotent/reconciled. Google content remains provider-source-of-truth. Domain logic belongs in services, not React components. Every feature has explicit loading/error/empty/permission/integration states.
