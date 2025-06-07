# Compare commits' files

Check whether the specified files were changed in a pull request or push
(or between two arbitrary commits).

This action uses GitHub API and not `git` CLI,
so it won't work for local commits that weren't pushed to GitHub.

Intended use: skip jobs or steps if relevant files were not changed.

## Inputs

### `repository`

The owner and repository name, in `owner/name` format.

_Default_: `${{ github.repository }}` -
the repository where the workflow was triggered.

### `files`

File path/name glob patterns to check, one pattern per line.
No default value. Required input.

Patterns starting with `!` exclude files.
Last matched pattern determines whether to include or exclude the file.

Only files are matched. To include directories, use `dir/**` syntax.

Only Unix path separator `/` is used, even on Windows.

See [minimatch](https://www.npmjs.com/package/minimatch) documentation
for syntax details.

### `base`

Base commit/branch to compare.

_Default_: Pull request/merge group base branch/commit.
Or the previous branch head for `push` event.

### `head`

Head commit/branch to compare.

_Default_: `${{ github.event.pull_request.merge_commit_sha || github.sha }}` -
the "current commit" or merge commit for pull requests.

> [!NOTE]
> There is a special case for `pull_request_target` event -
> because `${{ github.sha }}` will be the head of the default branch for `pull_request_target`.

### `github-token`

GitHub API token to use.

_Default_: `${{ github.token }}`

## Outputs

### `changed`

`true` if a change in `files` was detected, `false` otherwise.

There is no output with a file list, because GitHub API can return
an incomplete list of changed files (it returns up to 300 files) - see
https://docs.github.com/en/rest/commits/commits?apiVersion=2022-11-28#compare-two-commits.

When an incomplete list is detected, `changed` is always set to `true`,
even if the list doesn't contain any file matching `files` input.
