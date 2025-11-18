import 'dotenv/config';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN
});

// ULTRA-AGGRESSIVE search for ANY vault-related code
console.log('🔥 ULTRA-AGGRESSIVE VAULT HUNTER - FINDING ANYTHING EXPLOITABLE');
console.log('='.repeat(70));

// Search for ANY vault, lending, or DeFi protocol that might be vulnerable
const AGGRESSIVE_SEARCH_TERMS = [
  'vault totalAssets totalSupply language:Solidity',
  'pricePerShare language:Solidity',
  'convertToAssets language:Solidity', 
  'exchangeRate language:Solidity',
  'donation attack language:Solidity',
  'share price manipulation language:Solidity',
  'ERC4626 language:Solidity',
  'tokenized vault language:Solidity',
  'lending protocol language:Solidity',
  'yield vault language:Solidity',
  'defi vault language:Solidity',
  'amm liquidity language:Solidity',
  'price oracle language:Solidity'
];

async function aggressiveSearch() {
  let allResults = [];
  
  for (const term of AGGRESSIVE_SEARCH_TERMS.slice(0, 8)) {
    console.log(`\n🔍 Searching: "${term}"`);
    
    try {
      const { data } = await octokit.rest.search.code({
        q: term,
        per_page: 30
      });

      console.log(`   📊 Found: ${data.total_count} results`);
      
      data.items.forEach(item => {
        allResults.push({
          repo: item.repository.full_name,
          url: item.html_url,
          file: item.name,
          score: calculateAggressiveScore(item)
        });
      });
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.log(`   ❌ Search failed: ${error.message}`);
    }
  }

  // Deduplicate and sort by score
  const uniqueResults = [...new Map(allResults.map(item => [item.repo, item])).values()];
  const sortedResults = uniqueResults.sort((a, b) => b.score - a.score);
  
  console.log('\n🎯 TOP AGGRESSIVE FINDINGS:');
  console.log('─'.repeat(50));
  
  sortedResults.slice(0, 15).forEach((result, index) => {
    console.log(`${index + 1}. ${result.repo}`);
    console.log(`   🔗 ${result.url}`);
    console.log(`   📄 ${result.file}`);
    console.log(`   ⭐ Score: ${result.score}`);
    console.log('');
  });

  console.log(`\n�� Found ${sortedResults.length} potential targets total`);
  console.log('💡 Manually investigate the top 10-15 for real vulnerabilities!');
}

function calculateAggressiveScore(item) {
  let score = 0;
  
  // Higher score for more specific vulnerability terms
  if (item.name.includes('Vault')) score += 20;
  if (item.name.includes('ERC4626')) score += 25;
  if (item.name.includes('price') || item.name.includes('share')) score += 15;
  if (item.path.includes('contracts') || item.path.includes('src')) score += 10;
  
  return score;
}

aggressiveSearch().catch(console.error);
