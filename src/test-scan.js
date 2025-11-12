import 'dotenv/config';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function quickTest() {
  console.log('🧪 Running quick repository accessibility test...\n');
  
  const testRepos = [
    'compound-finance/compound-protocol',
    'aave/aave-v3-core', 
    'openzeppelin/openzeppelin-contracts',
    'Uniswap/v3-core'
  ];

  for (const repo of testRepos) {
    try {
      const [owner, name] = repo.split('/');
      const { data } = await octokit.rest.repos.get({ owner, repo: name });
      const { data: forks } = await octokit.rest.repos.listForks({ owner, repo: name, per_page: 5 });
      
      console.log(`✅ ${repo}: ${forks.length} forks, ${data.stargazers_count} stars`);
    } catch (error) {
      console.log(`❌ ${repo}: ${error.message}`);
    }
  }
}

quickTest();
