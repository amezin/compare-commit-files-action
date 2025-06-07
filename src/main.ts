import { inspect } from 'node:util';

import * as core from '@actions/core';
import { getOctokit } from '@actions/github';
import { requestLog } from '@octokit/plugin-request-log';

import { Minimatch, MinimatchOptions } from 'minimatch';

class Repository {
    private readonly octokit: ReturnType<typeof getOctokit>;
    private readonly owner: string;
    private readonly repo: string;

    constructor(octokit: ReturnType<typeof getOctokit>, repository: string) {
        const [owner, repo, ...extra] = repository.split('/');

        if (!owner || !repo || extra.length) {
            throw new Error(
                `Invalid repository '${repository}'. Expected format {owner}/{repo}.`
            );
        }

        this.octokit = octokit;
        this.owner = owner;
        this.repo = repo;
    }

    async compareCommits(basehead: string) {
        const { octokit, owner, repo } = this;

        // Note: pagination is not needed. All files are returned on the first page.
        const { data } = await octokit.rest.repos.compareCommitsWithBasehead({
            owner,
            repo,
            basehead,
            per_page: 1, // Commit metadata is not needed
        });

        return data;
    }
}

async function run() {
    const log = {
        debug: core.isDebug()
            ? console.debug.bind(console)
            : (..._args: unknown[]) => {},
        info: console.info.bind(console),
        warn: console.warn.bind(console),
        error: console.error.bind(console),
    };

    const minimatchOptions: MinimatchOptions = {
        platform: 'linux', // We're matching against paths returned by API
        dot: true,
        flipNegate: true,
    };

    const token = core.getInput('github-token', { required: true });
    const repository = core.getInput('repository', { required: true });
    const base = core.getInput('base', { required: true });
    const head = core.getInput('head', { required: true });
    const patterns = core
        .getMultilineInput('files', { required: true })
        .map(pattern => new Minimatch(pattern.trim(), minimatchOptions))
        .filter(pattern => !pattern.comment && !pattern.empty)
        .reverse();

    const allNegated = !patterns.some(pattern => !pattern.negate);

    if (allNegated) {
        patterns.push(new Minimatch('**', minimatchOptions));
    }

    const github = getOctokit(token, { log }, requestLog);
    const repo = new Repository(github, repository);

    const { files } = await repo.compareCommits([base, head].join('...'));

    if (files?.length === 300) {
        core.setOutput('changed', true);
        core.info('Diff was truncated');
        return;
    }

    const filtered = files
        ?.flatMap(file =>
            [file.filename, file.previous_filename].filter(v => v)
        )
        .filter(filename => {
            const match = patterns.find(pattern => pattern.match(filename!));

            return match && !match.negate;
        });

    if (!filtered?.length) {
        core.setOutput('changed', false);
        core.info('No change detected');
        return;
    }

    core.setOutput('changed', true);

    core.startGroup('Changed files');

    for (const filename of filtered) {
        core.info(filename!);
    }

    core.endGroup();
}

run().catch((error: unknown) => {
    core.setFailed(String(error));
    core.debug(inspect(error));
});
