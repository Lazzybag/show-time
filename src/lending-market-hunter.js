import 'dotenv/config';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN
});

class LendingMarketHunter {
  constructor() {
    this.lendingMarkets = [];
    this.vulnerableIntegrations = [];
  }

  async huntLendingMarkets() {
    console.log('🎯 LENDING MARKET HUNTER - FINDING ERC4626 COLLATERAL INTEGRATIONS');
    console.log('='.repeat(70));

    // Your exact search strategy - finding lending markets that support ERC4626
    const searchQueries = [
      'erc4626 collateral lending market language:Solidity',
      'ERC4626 collateral language:Solidity',
      'vault shares collateral language:Solidity',
      'pricePerShare oracle language:Solidity',
      'convertToAssets collateral language:Solidity',
      'erc4626 lending protocol language:Solidity',
      'vault shares lending language:Solidity',
      'share price collateral language:Solidity'
    ];

    console.log('\n🔍 PHASE 1: Finding lending markets with ERC4626 support...');
    
    for (const query of searchQueries) {
      await this.searchLendingMarkets(query);
      await this.delay(800); // Rate limiting
    }

    console.log('\n🔍 PHASE 2: Analyzing found markets for vulnerabilities...');
    await this.analyzeMarketVulnerabilities();

    console.log('\n🔍 PHASE 3: Finding specific price oracle implementations...');
    await this.huntPriceOracles();

    this.generateLendingMarketReport();
  }

  async searchLendingMarkets(query) {
    console.log(`   Searching: "${query}"`);
    
    try {
      const { data } = await octokit.rest.search.code({
        q: query,
        per_page: 20
      });

      console.log(`   📊 Found ${data.items.length} potential lending markets`);

      for (const item of data.items) {
        const marketInfo = {
          repository: item.repository.full_name,
          url: item.html_url,
          file: item.name,
          path: item.path,
          type: this.classifyMarketType(item),
          query: query
        };

        // Avoid duplicates
        if (!this.lendingMarkets.find(m => m.repository === marketInfo.repository)) {
          this.lendingMarkets.push(marketInfo);
          console.log(`      📈 Found: ${marketInfo.repository} - ${marketInfo.file}`);
        }
      }
    } catch (error) {
      console.log(`   ❌ Search failed: ${error.message}`);
    }
  }

  classifyMarketType(item) {
    const content = item.name + ' ' + item.path + ' ' + item.repository.description;
    
    if (content.toLowerCase().includes('compound') || content.includes('comptroller')) return 'Compound-Fork';
    if (content.toLowerCase().includes('aave')) return 'Aave-Fork';
    if (content.toLowerCase().includes('lending') && content.toLowerCase().includes('market')) return 'Lending-Market';
    if (content.toLowerCase().includes('vault') && content.toLowerCase().includes('collateral')) return 'Vault-Collateral';
    if (content.toLowerCase().includes('oracle') && content.toLowerCase().includes('price')) return 'Price-Oracle';
    
    return 'Unknown-Lending';
  }

  async analyzeMarketVulnerabilities() {
    console.log('\n   Analyzing lending markets for vulnerable integration patterns...');
    
    for (const market of this.lendingMarkets.slice(0, 15)) { // Analyze top 15
      const [owner, repo] = market.repository.split('/');
      
      try {
        const vulnerabilities = await this.checkMarketVulnerabilities(owner, repo);
        
        if (vulnerabilities.length > 0) {
          console.log(`      💀 VULNERABLE: ${market.repository} - ${vulnerabilities.length} issues`);
          this.vulnerableIntegrations.push({
            market: market.repository,
            url: market.url,
            vulnerabilities: vulnerabilities,
            risk: 'HIGH'
          });
        } else {
          console.log(`      ✅ CLEAN: ${market.repository}`);
        }
      } catch (error) {
        console.log(`      ❌ Cannot analyze ${market.repository}: ${error.message}`);
      }
      
      await this.delay(600);
    }
  }

  async checkMarketVulnerabilities(owner, repo) {
    const vulnerabilities = [];
    
    try {
      // Get repository structure to find relevant files
      const { data: contents } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: ''
      });

      // Look for key files that might contain vulnerable integrations
      const keyFiles = contents.filter(item => 
        item.type === 'file' && 
        (item.name.includes('Oracle') || 
         item.name.includes('Market') || 
         item.name.includes('Controller') ||
         item.name.includes('Lending') ||
         item.name.includes('Vault') ||
         item.name.endsWith('.sol'))
      );

      for (const file of keyFiles.slice(0, 10)) {
        const fileVulns = await this.analyzeMarketFile(owner, repo, file);
        vulnerabilities.push(...fileVulns);
      }

    } catch (error) {
      // Skip if we can't access
    }
    
    return vulnerabilities;
  }

  async analyzeMarketFile(owner, repo, file) {
    const vulnerabilities = [];
    
    try {
      const { data: fileContent } = await octokit.rest.repos.getContent({
        owner,
        repo,
        path: file.path
      });

      const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
      
      // Check for vulnerable patterns in lending market integrations
      const vulnerablePatterns = [
        {
          pattern: /\.convertToAssets\(|\.pricePerShare\(|vault\.convertToAssets/,
          type: 'Direct-Vault-Price-Call',
          description: 'Directly using vault price functions without validation',
          severity: 'HIGH'
        },
        {
          pattern: /getPrice.*vault|getValue.*vault|getCollateralValue.*vault/,
          type: 'Vault-Collateral-Valuation',
          description: 'Custom vault collateral valuation functions',
          severity: 'MEDIUM'
        },
        {
          pattern: /totalAssets.*totalSupply.*collateral|pricePerShare.*collateral/,
          type: 'Naive-Vault-Price-In-Collateral',
          description: 'Using naive vault price in collateral calculations',
          severity: 'HIGH'
        },
        {
          pattern: /ERC4626.*collateral|vault.*collateral/,
          type: 'ERC4626-Collateral-Support',
          description: 'Explicit ERC4626 vault collateral support',
          severity: 'MEDIUM'
        }
      ];

      for (const vulnPattern of vulnerablePatterns) {
        if (vulnPattern.pattern.test(content)) {
          vulnerabilities.push({
            file: file.name,
            type: vulnPattern.type,
            description: vulnPattern.description,
            severity: vulnPattern.severity
          });
        }
      }

    } catch (error) {
      // Skip file if we can't read it
    }
    
    return vulnerabilities;
  }

  async huntPriceOracles() {
    console.log('\n   Hunting for vulnerable price oracle implementations...');
    
    const oracleQueries = [
      'vault price oracle language:Solidity',
      'erc4626 oracle language:Solidity',
      'share price oracle language:Solidity',
      'getPricePerShare language:Solidity'
    ];

    for (const query of oracleQueries) {
      try {
        const { data } = await octokit.rest.search.code({
          q: query,
          per_page: 15
        });

        for (const item of data.items) {
          const oracleInfo = {
            repository: item.repository.full_name,
            url: item.html_url,
            file: item.name,
            type: 'Price-Oracle',
            query: query
          };

          if (!this.lendingMarkets.find(m => m.repository === oracleInfo.repository)) {
            this.lendingMarkets.push(oracleInfo);
            console.log(`      📊 Found Oracle: ${oracleInfo.repository}`);
          }
        }
      } catch (error) {
        console.log(`      ❌ Oracle search failed: ${error.message}`);
      }
      
      await this.delay(700);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateLendingMarketReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 LENDING MARKET HUNTING REPORT');
    console.log('='.repeat(80));

    console.log(`\n📈 FOUND ${this.lendingMarkets.length} POTENTIAL LENDING MARKETS`);
    console.log(`🚨 FOUND ${this.vulnerableIntegrations.length} VULNERABLE INTEGRATIONS`);

    if (this.vulnerableIntegrations.length > 0) {
      console.log('\n💀 VULNERABLE LENDING MARKETS (YOUR POTENTIAL CLIENTS):');
      console.log('─'.repeat(70));
      
      this.vulnerableIntegrations.forEach((market, index) => {
        console.log(`\n${index + 1}. ${market.market}`);
        console.log(`   🔗 ${market.url}`);
        console.log(`   ⚠️  Risk: ${market.risk}`);
        console.log(`   📊 Vulnerabilities Found:`);
        market.vulnerabilities.forEach(vuln => {
          console.log(`      - ${vuln.type}: ${vuln.description} (${vuln.severity})`);
        });
      });
    }

    // Show all found markets for broader targeting
    console.log('\n📋 ALL POTENTIAL LENDING MARKETS FOUND:');
    console.log('─'.repeat(50));
    
    this.lendingMarkets.slice(0, 20).forEach((market, index) => {
      console.log(`${index + 1}. ${market.repository}`);
      console.log(`   📄 ${market.file} (${market.type})`);
    });

    console.log(`\n🎯 STRATEGIC RECOMMENDATIONS:`);
    console.log(`   1. Focus on markets with 'HIGH' risk vulnerabilities first`);
    console.log(`   2. Contact projects with explicit ERC4626 collateral support`);
    console.log(`   3. Offer security audits for their vault integration logic`);
    console.log(`   4. Prepare exploit demonstrations for responsible disclosure`);

    console.log(`\n💼 BUSINESS OPPORTUNITY: You now have ${this.lendingMarkets.length} potential clients!`);
  }
}

// Run the lending market hunter
const hunter = new LendingMarketHunter();
hunter.huntLendingMarkets().catch(console.error);
