import 'dotenv/config';

// Your exact approach - simple and effective for finding lending markets
const SEARCH_QUERIES = [
  'erc4626 collateral lending market',
  'ERC4626 collateral',
  'vault shares collateral', 
  'pricePerShare oracle',
  'erc4626 lending protocol'
];

console.log('🔍 QUICK LENDING MARKET SEARCH (Your Approach)');
console.log('='.repeat(50));

async function quickSearch() {
  for (const query of SEARCH_QUERIES) {
    console.log(`\nSearching: "${query}"`);
    
    try {
      const response = await fetch(
        `https://api.github.com/search/code?q=${encodeURIComponent(query)}+language:Solidity&per_page=10`,
        {
          headers: {
            'Authorization': `token ${process.env.GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      const data = await response.json();
      
      if (data.items) {
        console.log(`Found ${data.items.length} results:`);
        data.items.forEach(item => {
          console.log(`  📍 ${item.repository.full_name}`);
          console.log(`     📄 ${item.name}`);
          console.log(`     🔗 ${item.html_url}`);
          console.log('');
        });
      } else {
        console.log('  No results found');
      }
    } catch (error) {
      console.log(`  ❌ Search failed: ${error.message}`);
    }
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n�� Tip: Investigate these projects for ERC4626 collateral integration vulnerabilities!');
}

quickSearch().catch(console.error);
