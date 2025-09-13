# Branch Protection Setup

This repo includes `.github/workflows/enforce-branch-protection.yml` which applies required PR checks and review rules to `main` using the GitHub API.

## Steps
1. Create a fine-grained PAT with permission "Administration: Read and write" for this repository.
2. Add it as a repository secret named `GH_ADMIN_TOKEN`.
3. Run the workflow manually: Actions → Enforce Branch Protection → Run workflow.
4. Confirm protection on Settings → Branches → Branch protection rules (main).

Required checks configured come from `.github/branch-protection.json`.

