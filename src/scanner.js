import 'dotenv/config';
import { Octokit } from '@octokit/rest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vulnerabilities = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../config/vulnerabilities.json'), 'utf8')
);

const octokit = new Octokit({ 
  auth: process.env.GITHUB_TOKEN,
  userAgent: 'ForkHunter v2.0'
});

class ForkHunter {
  constructor() {
    this.results = [];
    this.scannedCount = 0;
    this.successfulScans = 0;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testAuth() {
    try {
      const { data: user } = await octokit.rest.users.getAuthenticated();
      console.log(`�� Authenticated as: ${user.login}`);
      
      // Test rate limits
      const { data: limits } = await octokit.rest.rateLimit.get();
      console.log(`📊 Rate limits: ${limits.resources.core.remaining}/${limits.resources.core.limit}`);
      
      return true;
    } catch (error) {
      console.error('❌ Authentication failed:', error.message);
      return false;
    }
  }

  async searchVulnerableForks() {
    console.log('🚀 Starting enhanced fork hunt...\n');
    
    for (const vuln of vulnerabilities.donationAttacks) {
      console.log(`\n🎯 Targeting: ${vuln.name}`);
      console.log(`📋 Known exploited patterns: ${vuln.exploitedProtocols.join(', ')}`);
      
      for (const repo of vuln.exploitedProtocols) {
        await this.scanForksFromRepo(repo, vuln);
        await this.delay(1500); // Respect rate limits
      }
    }
    
    this.generateReport();
  }

  async scanForksFromRepo(originalRepo, vulnerability) {
    console.log(`\n🔍 Scanning forks of: ${originalRepo}`);
    
    try {
      const [owner, repo] = originalRepo.split('/');
      
      // First verify the repo exists
      try {
        await octokit.rest.repos.get({ owner, repo });
      } catch (error) {
        console.log(`   ⚠️  Repository not found or inaccessible: ${originalRepo}`);
        return;
      }

      const { data: forks } = await octokit.rest.repos.listForks({
        owner,
        repo,
        sort: 'newest',
        per_page: 50 // Increased from 30
      });

      console.log(`📊 Found ${forks.length} forks for ${originalRepo}`);

      for (const fork of forks.slice(0, 25)) { // Scan first 25 forks per repo
        if (this.scannedCount >= 200) { // Increased limit
          console.log('📈 Reached maximum scan limit (200 repositories)');
          return;
        }

        this.scannedCount++;
        console.log(`\n🔎 [${this.scannedCount}] Analyzing: ${fork.full_name}`);
        console.log(`   📍 URL: ${fork.html_url}`);
        console.log(`   ⭐ Stars: ${fork.stargazers_count}`);
        console.log(`   🍴 Forks: ${fork.forks_count}`);
        console.log(`   📅 Updated: ${new Date(fork.updated_at).toLocaleDateString()}`);
        
        const riskScore = await this.assessRisk(fork, vulnerability);
        
        if (riskScore >= 7) {
          console.log(`   🚨 HIGH RISK DETECTED: ${riskScore}/10`);
          this.results.push({
            repository: fork.full_name,
            url: fork.html_url,
            riskScore,
            vulnerability: vulnerability.name,
            lastUpdated: fork.updated_at,
            stars: fork.stargazers_count,
            forks: fork.forks_count,
            reason: 'Active fork with potential vulnerable code patterns'
          });
        } else if (riskScore >= 5) {
          console.log(`   ⚠️  MEDIUM RISK: ${riskScore}/10`);
        } else {
          console.log(`   ✅ LOW RISK: ${riskScore}/10`);
        }

        this.successfulScans++;

        // Rate limit cooldown
        if (this.scannedCount % 5 === 0) {
          console.log('💤 Rate limit cooldown...');
          await this.delay(2000);
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${originalRepo}:`, error.message);
    }
  }

  async assessRisk(fork, vulnerability) {
    let riskScore = 0;

    // Base risk from popularity and activity
    if (fork.stargazers_count > 5) riskScore += 2;
    if (fork.stargazers_count > 20) riskScore += 2;
    if (fork.forks_count > 2) riskScore += 2;
    if (fork.forks_count > 10) riskScore += 2;
    
    // Recent activity increases risk significantly
    const lastUpdated = new Date(fork.updated_at);
    const daysSinceUpdate = (new Date() - lastUpdated) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 180) riskScore += 1;
    if (daysSinceUpdate < 90) riskScore += 1;
    if (daysSinceUpdate < 30) riskScore += 2;
    if (daysSinceUpdate < 7) riskScore += 2;

    try {
      // Get repository contents to check for vulnerable files
      const { data: contents } = await octokit.rest.repos.getContent({
        owner: fork.owner.login,
        repo: fork.name,
        path: ''
      });

      // Look for critical Solidity files
      const solidityFiles = contents.filter(file => 
        (file.type === 'file' && file.name.endsWith('.sol')) ||
        (file.type === 'dir' && file.name.toLowerCase().includes('contract'))
      );

      if (solidityFiles.length > 0) {
        riskScore += 2;
        console.log(`   📄 Found ${solidityFiles.length} potential contract files`);
      }

      // Check specific file patterns
      const criticalFiles = contents.filter(file => 
        file.type === 'file' && 
        vulnerabilities.criticalFiles.some(critical => 
          file.name.includes(critical)
        )
      );

      if (criticalFiles.length > 0) {
        riskScore += 3;
        console.log(`   💀 Found critical files: ${criticalFiles.map(f => f.name).join(', ')}`);
      }

      // Sample a few files to check for vulnerable patterns
      for (const file of criticalFiles.slice(0, 2)) {
        try {
          const { data: fileContent } = await octokit.rest.repos.getContent({
            owner: fork.owner.login,
            repo: fork.name,
            path: file.path
          });
          
          if (fileContent.content) {
            const content = Buffer.from(fileContent.content, 'base64').toString('utf8');
            
            // Check for vulnerable price calculation patterns
            const vulnerablePatterns = [
              /totalAssets\s*\/\s*totalSupply/,
              /pricePerShare\s*=\s*totalAssets\s*\/\s*totalSupply/,
              /convertToAssets.*1e18/,
              /exchangeRate.*=.*totalSupply/
            ];

            for (const pattern of vulnerablePatterns) {
              if (pattern.test(content)) {
                riskScore += 4;
                console.log(`   🔥 VULNERABLE CODE PATTERN in ${file.name}: ${pattern.toString()}`);
                break;
              }
            }
          }
        } catch (e) {
          // Skip if we can't read the file
        }
      }

    } catch (error) {
      // Can't access repo contents, slightly lower risk but still possible
      console.log(`   🔒 Cannot access repository contents`);
      riskScore += 1; // Still some risk if we can't inspect
    }

    return Math.min(riskScore, 10);
  }

  generateReport() {
    console.log('\n' + '='.repeat(80));
    console.log('🎯 SCAN COMPLETE - VULNERABILITY REPORT');
    console.log('='.repeat(80));
    
    console.log(`\n📊 Scan Statistics:`);
    console.log(`   Total repositories scanned: ${this.scannedCount}`);
    console.log(`   Successful scans: ${this.successfulScans}`);
    console.log(`   High-risk findings: ${this.results.length}`);
    
    if (this.results.length === 0) {
      console.log('\n✅ No high-risk vulnerabilities found in scanned forks.');
      console.log('💡 Try increasing the scan limit or adding more target repositories.');
      return;
    }

    // Sort by risk score
    this.results.sort((a, b) => b.riskScore - a.riskScore);

    console.log(`\n�� FOUND ${this.results.length} HIGH-RISK REPOSITORIES:\n`);

    this.results.forEach((result, index) => {
      console.log(`${index + 1}. ${result.repository}`);
      console.log(`   🔗 ${result.url}`);
      console.log(`   💀 Risk Score: ${result.riskScore}/10`);
      console.log(`   🎯 Vulnerability: ${result.vulnerability}`);
      console.log(`   ⭐ Stars: ${result.stars} | 🍴 Forks: ${result.forks}`);
      console.log(`   📅 Last Updated: ${new Date(result.lastUpdated).toLocaleDateString()}`);
      console.log('   '.padEnd(50, '-'));
    });

    // Save detailed report
    const report = {
      scanDate: new Date().toISOString(),
      scanStats: {
        totalScanned: this.scannedCount,
        successfulScans: this.successfulScans,
        highRiskFindings: this.results.length
      },
      highRiskRepositories: this.results
    };

    if (!fs.existsSync('results')) {
      fs.mkdirSync('results');
    }

    const reportFile = `results/vulnerability-report-${Date.now()}.json`;
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

    console.log(`\n📊 Detailed report saved to: ${reportFile}`);
    
    // Generate quick action summary
    console.log('\n⚡ QUICK ACTIONS:');
    this.results.slice(0, 5).forEach((result, index) => {
      console.log(`${index + 1}. Review: ${result.repository} - ${result.url}`);
    });

    console.log('\n🔍 NEXT STEPS:');
    console.log('   1. Manually verify the high-risk repositories');
    console.log('   2. Check if they are deployed on mainnet');
    console.log('   3. Look for active development activity');
    console.log('   4. Consider responsible disclosure if vulnerabilities are confirmed');
  }
}

// Execute scanner
async function main() {
  console.log('🦅 DeFi Fork Hunter v2.0 - Enhanced Vulnerability Scanner');
  console.log('='.repeat(60));
  
  const hunter = new ForkHunter();
  
  if (!await hunter.testAuth()) {
    process.exit(1);
  }

  await hunter.searchVulnerableForks();
}

main().catch(console.error);
