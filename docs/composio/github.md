# GitHub — Composio Actions Reference

## Toolkit: `github` (managed app ✓)

### Actions mapeadas

| Route | Action | Descrição |
|-------|--------|-----------|
| `GET /repos` | `GITHUB_LIST_REPOS_FOR_AUTHENTICATED_USER` | Listar repos |
| `GET /repos/{owner}/{repo}` | `GITHUB_GET_A_REPOSITORY` | Obter repo |
| `GET /repos/{owner}/{repo}/issues` | `GITHUB_LIST_ISSUES_FOR_A_REPOSITORY` | Listar issues |
| `POST /repos/{owner}/{repo}/issues` | `GITHUB_CREATE_AN_ISSUE` | Criar issue |
| `GET /notifications` | `GITHUB_LIST_NOTIFICATIONS_FOR_AUTHENTICATED_USER` | Notificações |

### Hook: `useComposioGithub`
- `listRepos()` — listar repositórios
- `getRepo(owner, repo)` — obter repositório
- `listIssues(owner, repo)` — listar issues
- `createIssue(owner, repo, title, body?)` — criar issue
- `listNotifications()` — listar notificações
