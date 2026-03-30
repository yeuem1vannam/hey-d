## Naming conventions

### Components
- Files: PascalCase with `.tsx` extension
- Directory: `src/components/` (plural)
- Primary named export matches the file name
- For multi-file components, use `ComponentName/index.tsx` and export only what is needed

```
// CORRECT
src/components/UserCard.tsx        → export function UserCard() {}
src/components/NavBar/index.tsx    → export function NavBar() {}

// WRONG
src/component/user-card.tsx
src/components/userCard.tsx
src/components/user_card.tsx
```

### Hooks
- Files: `camelCase` prefixed with `use`, `.ts` extension
- Directory: `src/hooks/`

```
// CORRECT
src/hooks/useAuth.ts
src/hooks/useLocalStorage.ts

// WRONG
src/hooks/use-auth.ts
src/hooks/UseAuth.ts
```

### Utilities and libs
- Files: `camelCase` with `.ts` extension
- Directory: `src/lib/` or `src/utils/`

```
// CORRECT
src/lib/formatDate.ts
src/utils/parseQuery.ts
```

### Types
- Files: `camelCase` with `.ts` extension
- Directory: `src/types/`

```
// CORRECT
src/types/user.ts
src/types/apiResponse.ts
```
