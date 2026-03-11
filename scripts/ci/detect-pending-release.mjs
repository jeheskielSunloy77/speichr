import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const outputPath = process.env.GITHUB_OUTPUT
const defaultBranch = process.env.DEFAULT_BRANCH
const currentRef = process.env.CURRENT_REF
const githubToken = process.env.GITHUB_TOKEN
const repository = process.env.REPOSITORY

const append = (key, value) => {
  fs.appendFileSync(outputPath, `${key}=${value}\n`)
}

const currentPackage = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const currentVersion = currentPackage.version

append('version', currentVersion)
append('tag_name', `v${currentVersion}`)

if (currentRef !== defaultBranch) {
  append('should_release', 'false')
  process.exit(0)
}

execFileSync('git', ['fetch', '--tags', 'origin'], { stdio: 'inherit' })

const releaseExists = (() => {
  try {
    execFileSync(
      'curl',
      [
        '--silent',
        '--show-error',
        '--fail',
        '--location',
        '-H',
        'Accept: application/vnd.github+json',
        '-H',
        `Authorization: Bearer ${githubToken}`,
        '-H',
        'X-GitHub-Api-Version: 2022-11-28',
        `https://api.github.com/repos/${repository}/releases/tags/v${currentVersion}`,
      ],
      { stdio: 'ignore' },
    )
    return true
  } catch {
    return false
  }
})()

append('should_release', releaseExists ? 'false' : 'true')
