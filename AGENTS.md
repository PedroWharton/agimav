<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Post-cutover backlog — surface this to the user

`docs/post-cutover-backlog.md` tracks deferred concerns (SMTP, mobile ergonomics, MTBF snapshot column, Sentry, seed guard, etc.). **Before starting any non-trivial task, skim that file.** If the user's request touches a backlog item — or if the task naturally enables one — flag it so they can decide to in-scope it.
