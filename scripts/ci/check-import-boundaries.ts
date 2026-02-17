import fs from 'node:fs'
import path from 'node:path'

type Violation = {
  file: string
  specifier: string
  reason: string
}

const PROJECT_ROOT = process.cwd()
const SOURCE_ROOT = path.join(PROJECT_ROOT, 'src')

const DOMAIN_FORBIDDEN_PACKAGES = new Set([
  'electron',
  'react',
  'react-dom',
  'better-sqlite3',
  'redis',
  'memjs',
  'keytar',
])

const collectSourceFiles = (directory: string): string[] => {
  const entries = fs.readdirSync(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(fullPath))
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.tsx')) {
      continue
    }

    files.push(fullPath)
  }

  return files
}

const readImportSpecifiers = (source: string): string[] => {
  const specifiers = new Set<string>()
  const fromImport = /from\s+['"]([^'"]+)['"]/g
  const bareImport = /import\s+['"]([^'"]+)['"]/g

  for (const pattern of [fromImport, bareImport]) {
    let match = pattern.exec(source)
    while (match) {
      specifiers.add(match[1])
      match = pattern.exec(source)
    }
  }

  return Array.from(specifiers)
}

const normalizeTarget = (filePath: string, specifier: string): string | null => {
  if (specifier.startsWith('@/')) {
    return path.normalize(path.join(SOURCE_ROOT, specifier.slice(2)))
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    return path.normalize(path.resolve(path.dirname(filePath), specifier))
  }

  return null
}

const isWithin = (targetPath: string, directoryPath: string): boolean => {
  const normalizedDirectory = path.normalize(directoryPath + path.sep)
  return targetPath.startsWith(normalizedDirectory)
}

const checkFile = (filePath: string, specifier: string): Violation | null => {
  const normalizedFile = path.normalize(filePath)
  const target = normalizeTarget(normalizedFile, specifier)

  if (isWithin(normalizedFile, path.join(SOURCE_ROOT, 'renderer'))) {
    if (target && isWithin(target, path.join(SOURCE_ROOT, 'main'))) {
      return {
        file: normalizedFile,
        specifier,
        reason: 'renderer must not import main-process modules',
      }
    }
  }

  if (isWithin(normalizedFile, path.join(SOURCE_ROOT, 'preload'))) {
    if (target && isWithin(target, path.join(SOURCE_ROOT, 'main'))) {
      return {
        file: normalizedFile,
        specifier,
        reason: 'preload must not import main-process modules',
      }
    }
  }

  if (isWithin(normalizedFile, path.join(SOURCE_ROOT, 'shared'))) {
    if (
      target &&
      (isWithin(target, path.join(SOURCE_ROOT, 'main')) ||
        isWithin(target, path.join(SOURCE_ROOT, 'renderer')) ||
        isWithin(target, path.join(SOURCE_ROOT, 'preload')))
    ) {
      return {
        file: normalizedFile,
        specifier,
        reason: 'shared layer must not import runtime-specific layers',
      }
    }
  }

  if (isWithin(normalizedFile, path.join(SOURCE_ROOT, 'main', 'domain'))) {
    if (
      target &&
      (isWithin(target, path.join(SOURCE_ROOT, 'main', 'infrastructure')) ||
        isWithin(target, path.join(SOURCE_ROOT, 'main', 'interface-adapters')) ||
        isWithin(target, path.join(SOURCE_ROOT, 'main', 'persistence')))
    ) {
      return {
        file: normalizedFile,
        specifier,
        reason: 'domain layer must not depend on outer main-process layers',
      }
    }

    if (DOMAIN_FORBIDDEN_PACKAGES.has(specifier)) {
      return {
        file: normalizedFile,
        specifier,
        reason: 'domain layer must remain framework and infrastructure agnostic',
      }
    }
  }

  if (isWithin(normalizedFile, path.join(SOURCE_ROOT, 'main', 'application'))) {
    if (
      target &&
      (isWithin(target, path.join(SOURCE_ROOT, 'main', 'infrastructure')) ||
        isWithin(target, path.join(SOURCE_ROOT, 'main', 'interface-adapters')) ||
        isWithin(target, path.join(SOURCE_ROOT, 'main', 'persistence')))
    ) {
      return {
        file: normalizedFile,
        specifier,
        reason: 'application layer must not depend on outer main-process layers',
      }
    }
  }

  return null
}

const files = collectSourceFiles(SOURCE_ROOT)
const violations: Violation[] = []

for (const filePath of files) {
  const source = fs.readFileSync(filePath, 'utf8')
  const specifiers = readImportSpecifiers(source)
  for (const specifier of specifiers) {
    const violation = checkFile(filePath, specifier)
    if (violation) {
      violations.push(violation)
    }
  }
}

if (violations.length > 0) {
  console.error('Import boundary violations found:')
  for (const violation of violations) {
    console.error(
      `- ${path.relative(PROJECT_ROOT, violation.file)} imports "${violation.specifier}" (${violation.reason})`,
    )
  }
  process.exit(1)
}

console.log(`Import boundary checks passed (${files.length} files).`)
