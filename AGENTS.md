<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- CxC/CxP use shared currency helpers with VES accounting for new transactions; preserve legacy accounting_currency records instead of silently rewriting historical balances.
- BCV rates are fetched through an authenticated server function with secure TLS, validated official HTML and visible effective dates; never substitute invented rates when unavailable.
- schema_completo.sql is a schema-only snapshot from the live PostgreSQL catalog, not an incremental migration; managed authentication is a prerequisite and app-owned auth triggers are included without exporting credentials.
