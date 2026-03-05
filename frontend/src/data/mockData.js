/**
 * Generate mock GitHub users for testing the city
 *
 * Each user has:
 * - username
 * - commits (random 10–5000)
 * - repos (random 1–50)
 * - recentActivity (boolean, ~40% chance)
 * - topLanguage
 */

const LANGUAGES = [
  'JavaScript', 'TypeScript', 'Python', 'Rust', 'Go',
  'Java', 'C++', 'Ruby', 'Swift', 'Kotlin',
  'C#', 'PHP', 'Dart', 'Scala', 'Elixir',
]

const PREFIXES = [
  'code', 'dev', 'hack', 'byte', 'pixel',
  'neo', 'cyber', 'data', 'cloud', 'stack',
  'git', 'node', 'react', 'rust', 'go',
  'web', 'app', 'sys', 'net', 'io',
]

const SUFFIXES = [
  'master', 'ninja', 'wizard', 'smith', 'forge',
  'lab', 'hub', 'ops', 'craft', 'flow',
  'x', '42', '99', 'dev', 'pro',
  'io', 'ai', 'ml', 'js', 'rs',
]

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateUsername() {
  const prefix = randomChoice(PREFIXES)
  const suffix = randomChoice(SUFFIXES)
  const num = Math.random() > 0.5 ? randomInt(1, 999) : ''
  return `${prefix}${suffix}${num}`
}

export function generateMockUsers(count = 100) {
  const usersSet = new Set()
  const users = []

  for (let i = 0; i < count; i++) {
    let username = generateUsername(i)
    // Ensure unique
    while (usersSet.has(username)) {
      username = generateUsername(i) + randomInt(1, 99)
    }
    usersSet.add(username)

    // Weight distribution: more users with lower commits
    const commitTier = Math.random()
    let commits
    if (commitTier < 0.5) {
      commits = randomInt(10, 200) // casual
    } else if (commitTier < 0.8) {
      commits = randomInt(200, 1000) // active
    } else if (commitTier < 0.95) {
      commits = randomInt(1000, 3000) // power user
    } else {
      commits = randomInt(3000, 5000) // legend
    }

    const repos = randomInt(1, 50)
    const recentActivity = Math.random() < 0.4
    const topLanguage = randomChoice(LANGUAGES)

    users.push({
      username,
      commits,
      repos,
      recentActivity,
      topLanguage,
      avatarUrl: `https://api.dicebear.com/7.x/identicon/svg?seed=${username}`,
    })
  }

  // Sort by commits descending so tall buildings are towards center
  users.sort((a, b) => b.commits - a.commits)

  return users
}

// Celebrity mock users to always include
export const CELEBRITY_USERS = [
  { username: 'torvalds', commits: 4500, repos: 8, recentActivity: true, topLanguage: 'C', avatarUrl: '' },
  { username: 'gaearon', commits: 3200, repos: 45, recentActivity: true, topLanguage: 'JavaScript', avatarUrl: '' },
  { username: 'sindresorhus', commits: 4000, repos: 1100, recentActivity: true, topLanguage: 'TypeScript', avatarUrl: '' },
  { username: 'tj', commits: 2800, repos: 300, recentActivity: false, topLanguage: 'Go', avatarUrl: '' },
  { username: 'yyx990803', commits: 3500, repos: 40, recentActivity: true, topLanguage: 'TypeScript', avatarUrl: '' },
]
