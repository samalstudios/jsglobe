const TEMPLATES = [
  {
    id: 'node',
    name: 'Node',
    group: 'language',
    rules: [
      'node_modules/',
      'npm-debug.log*',
      'yarn-debug.log*',
      'yarn-error.log*',
      'pnpm-debug.log*',
      'lerna-debug.log*',
      '.npm',
      '.yarn/cache',
      '.yarn/install-state.gz',
      '.pnp.*',
      '*.tsbuildinfo',
      'coverage/',
      '.nyc_output/',
    ],
  },
  {
    id: 'python',
    name: 'Python',
    group: 'language',
    rules: [
      '__pycache__/',
      '*.py[cod]',
      '*$py.class',
      '.Python',
      'build/',
      'dist/',
      '*.egg-info/',
      '.eggs/',
      '.venv/',
      'venv/',
      'env/',
      '.pytest_cache/',
      '.mypy_cache/',
      '.ruff_cache/',
      '.coverage',
      'htmlcov/',
      '.tox/',
    ],
  },
  {
    id: 'java',
    name: 'Java',
    group: 'language',
    rules: ['*.class', '*.jar', '*.war', '*.ear', 'target/', 'build/', '.gradle/', 'hs_err_pid*', 'replay_pid*'],
  },
  {
    id: 'go',
    name: 'Go',
    group: 'language',
    rules: ['*.exe', '*.exe~', '*.dll', '*.so', '*.dylib', '*.test', '*.out', 'go.work', 'go.work.sum', 'vendor/', 'bin/'],
  },
  {
    id: 'rust',
    name: 'Rust',
    group: 'language',
    rules: ['target/', 'Cargo.lock', '**/*.rs.bk', '*.pdb'],
    note: 'Keep Cargo.lock for an application, ignore it for a library.',
  },
  {
    id: 'ruby',
    name: 'Ruby',
    group: 'language',
    rules: ['*.gem', '*.rbc', '/.bundle/', '/vendor/bundle', '/log/*', '/tmp/*', '.byebug_history', 'coverage/'],
  },
  {
    id: 'php',
    name: 'PHP',
    group: 'language',
    rules: ['/vendor/', 'composer.phar', '.phpunit.result.cache', '.php-cs-fixer.cache'],
  },
  {
    id: 'dotnet',
    name: '.NET',
    group: 'language',
    rules: ['bin/', 'obj/', '*.user', '*.suo', '*.userprefs', '.vs/', 'TestResults/', 'artifacts/', '*.nupkg'],
  },
  {
    id: 'swift',
    name: 'Swift',
    group: 'language',
    rules: ['.build/', 'DerivedData/', '*.xcuserstate', 'xcuserdata/', '*.xcscmblueprint', 'Packages/', '.swiftpm/'],
  },
  {
    id: 'cpp',
    name: 'C and C++',
    group: 'language',
    rules: ['*.o', '*.obj', '*.a', '*.lib', '*.so', '*.dylib', '*.dll', '*.exe', 'build/', 'cmake-build-*/', 'CMakeFiles/', 'CMakeCache.txt'],
  },
  {
    id: 'elixir',
    name: 'Elixir',
    group: 'language',
    rules: ['_build/', 'deps/', '*.ez', 'cover/', '.elixir_ls/', 'erl_crash.dump'],
  },

  {
    id: 'react',
    name: 'React and Vite',
    group: 'framework',
    rules: ['dist/', 'dist-ssr/', '.vite/', 'build/', '*.local'],
  },
  {
    id: 'next',
    name: 'Next.js',
    group: 'framework',
    rules: ['.next/', 'out/', '.vercel', 'next-env.d.ts'],
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    group: 'framework',
    rules: ['.nuxt/', '.output/', '.nitro/', '.cache/', 'dist/'],
  },
  {
    id: 'angular',
    name: 'Angular',
    group: 'framework',
    rules: ['/dist/', '/tmp/', '/out-tsc/', '/bazel-out/', '.angular/'],
  },
  {
    id: 'django',
    name: 'Django',
    group: 'framework',
    rules: ['*.log', 'db.sqlite3', 'db.sqlite3-journal', '/media/', '/staticfiles/', 'local_settings.py'],
  },
  {
    id: 'rails',
    name: 'Rails',
    group: 'framework',
    rules: ['/log/*', '/tmp/*', '/storage/*', '/public/assets', '/public/packs', '/node_modules', '/config/master.key'],
  },
  {
    id: 'laravel',
    name: 'Laravel',
    group: 'framework',
    rules: ['/vendor/', '/public/build', '/public/hot', '/public/storage', '/storage/*.key', 'Homestead.yaml'],
  },
  {
    id: 'flutter',
    name: 'Flutter',
    group: 'framework',
    rules: ['.dart_tool/', '.packages', 'build/', '.flutter-plugins', '.flutter-plugins-dependencies', '*.iml'],
  },
  {
    id: 'android',
    name: 'Android',
    group: 'framework',
    rules: ['*.apk', '*.aab', '*.ap_', '*.dex', 'local.properties', '.gradle/', 'build/', 'captures/', '.cxx/'],
  },
  {
    id: 'unity',
    name: 'Unity',
    group: 'framework',
    rules: ['/[Ll]ibrary/', '/[Tt]emp/', '/[Oo]bj/', '/[Bb]uild/', '/[Bb]uilds/', '/[Ll]ogs/', '/[Uu]serSettings/', '*.unitypackage'],
  },

  {
    id: 'terraform',
    name: 'Terraform',
    group: 'tooling',
    rules: ['.terraform/', '*.tfstate', '*.tfstate.*', 'crash.log', '*.tfvars', '.terraformrc', 'terraform.rc'],
    note: 'Never commit tfstate, it holds resource details and sometimes secrets.',
  },
  {
    id: 'docker',
    name: 'Docker',
    group: 'tooling',
    rules: ['.docker/', 'docker-compose.override.yml', '*.pid'],
  },
  {
    id: 'dotenv',
    name: 'Environment files',
    group: 'tooling',
    rules: ['.env', '.env.*', '!.env.example', '!.env.sample', '*.pem', '*.key', 'secrets.json'],
    note: 'Keep an example file in the repository so the shape of the settings stays documented.',
  },
  {
    id: 'jupyter',
    name: 'Jupyter',
    group: 'tooling',
    rules: ['.ipynb_checkpoints/', '*/.ipynb_checkpoints/*', 'profile_default/', 'ipython_config.py'],
  },
  {
    id: 'latex',
    name: 'LaTeX',
    group: 'tooling',
    rules: ['*.aux', '*.log', '*.out', '*.toc', '*.synctex.gz', '*.fls', '*.fdb_latexmk', '*.bbl', '*.blg'],
  },

  {
    id: 'macos',
    name: 'macOS',
    group: 'system',
    rules: ['.DS_Store', '.AppleDouble', '.LSOverride', 'Icon\r', '._*', '.Spotlight-V100', '.Trashes'],
  },
  {
    id: 'windows',
    name: 'Windows',
    group: 'system',
    rules: ['Thumbs.db', 'Thumbs.db:encryptable', 'ehthumbs.db', 'Desktop.ini', '$RECYCLE.BIN/', '*.lnk'],
  },
  {
    id: 'linux',
    name: 'Linux',
    group: 'system',
    rules: ['*~', '.fuse_hidden*', '.directory', '.Trash-*', '.nfs*'],
  },

  {
    id: 'vscode',
    name: 'VS Code',
    group: 'editor',
    rules: ['.vscode/*', '!.vscode/settings.json', '!.vscode/tasks.json', '!.vscode/launch.json', '!.vscode/extensions.json', '*.code-workspace'],
  },
  {
    id: 'jetbrains',
    name: 'JetBrains',
    group: 'editor',
    rules: ['.idea/', '*.iml', '*.iws', '*.ipr', 'out/', '.idea_modules/'],
  },
  {
    id: 'vim',
    name: 'Vim',
    group: 'editor',
    rules: ['*.swp', '*.swo', '*.swn', 'Session.vim', '.netrwhist', 'tags'],
  },
  {
    id: 'emacs',
    name: 'Emacs',
    group: 'editor',
    rules: ['*~', '\\#*\\#', '.\\#*', '.projectile', 'auto-save-list/'],
  },
  {
    id: 'sublime',
    name: 'Sublime Text',
    group: 'editor',
    rules: ['*.sublime-workspace', '*.tmlanguage.cache', '*.sublime_session'],
  },
];

export const GROUPS = [
  { id: 'language', name: 'Languages' },
  { id: 'framework', name: 'Frameworks' },
  { id: 'tooling', name: 'Tools' },
  { id: 'system', name: 'Systems' },
  { id: 'editor', name: 'Editors' },
];

export const templates = () => TEMPLATES.map((entry) => ({ ...entry, rules: [...entry.rules] }));

export const templateById = (id) => TEMPLATES.find((entry) => entry.id === id) ?? null;

export const groupOf = (id) => GROUPS.find((group) => group.id === id) ?? null;

// a rule that only unignores is worthless on its own, and a repeated rule adds
// nothing, so both are worth pointing out
export const reviewRules = (lines) => {
  const seen = new Map();
  const repeated = [];
  const negations = [];

  lines.forEach((line, at) => {
    const rule = line.trim();
    if (!rule || rule.startsWith('#')) return;
    if (rule.startsWith('!')) negations.push({ rule, at });
    if (seen.has(rule)) repeated.push({ rule, at, first: seen.get(rule) });
    else seen.set(rule, at);
  });

  const loose = negations.filter(({ rule }) => {
    const bare = rule.slice(1);
    return !lines.some((other) => {
      const candidate = other.trim();
      if (!candidate || candidate.startsWith('!') || candidate.startsWith('#')) return false;
      return matches(candidate, bare) || bare.startsWith(candidate.replace(/\/$/, '') + '/');
    });
  });

  return { repeated, looseNegations: loose, rules: seen.size };
};

// git patterns, close enough for telling a person what their file will do
export const matches = (pattern, path) => {
  let rule = pattern.trim();
  if (!rule || rule.startsWith('#')) return false;
  if (rule.startsWith('!')) rule = rule.slice(1);

  const folderOnly = rule.endsWith('/');
  if (folderOnly) rule = rule.slice(0, -1);

  const rooted = rule.startsWith('/') || rule.slice(0, -1).includes('/');
  if (rule.startsWith('/')) rule = rule.slice(1);

  const source = rule
    .split('**')
    .map((piece) =>
      piece
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '[^/]*')
        .replace(/\?/g, '[^/]'),
    )
    .join('.*');

  const target = path.replace(/^\.\//, '');
  const head = rooted ? '^' : '(^|.*/)';
  const tail = folderOnly ? '(/.*)?$' : '(/.*)?$';
  return new RegExp(`${head}${source}${tail}`).test(target);
};

export const ignores = (lines, path) => {
  let hit = false;
  for (const line of lines) {
    const rule = line.trim();
    if (!rule || rule.startsWith('#')) continue;
    if (!matches(rule, path)) continue;
    hit = !rule.startsWith('!');
  }
  return hit;
};

export const buildIgnore = (ids, extra = '') => {
  const picked = ids.map((id) => templateById(id)).filter(Boolean);
  const out = [];
  const seen = new Set();

  for (const template of picked) {
    const rules = template.rules.filter((rule) => {
      if (seen.has(rule)) return false;
      seen.add(rule);
      return true;
    });
    if (!rules.length) continue;
    out.push(`# ${template.name}`, ...rules, '');
  }

  const own = String(extra ?? '')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, at, all) => line || all[at - 1]);
  const kept = own.filter((line) => line.startsWith('#') || !seen.has(line.trim()));
  if (kept.some((line) => line.trim())) out.push('# This project', ...kept, '');

  while (out.length && !out[out.length - 1]) out.pop();
  return out.join('\n') + '\n';
};
