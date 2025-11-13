import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class ReportAnalyzer {
    constructor() {
        this.report = null;
        this.analysis = {};
    }

    loadLatestReport() {
        const resultsDir = path.join(__dirname, '../results');
        
        if (!fs.existsSync(resultsDir)) {
            console.log('❌ No results directory found. Run a scan first.');
            return false;
        }

        const files = fs.readdirSync(resultsDir)
            .filter(file => file.startsWith('vulnerability-report-') && file.endsWith('.json'))
            .sort()
            .reverse();

        if (files.length === 0) {
            console.log('❌ No vulnerability reports found. Run a scan first.');
            return false;
        }

        const latestFile = files[0];
        const filePath = path.join(resultsDir, latestFile);
        
        try {
            this.report = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            console.log(`✅ Loaded report: ${latestFile}`);
            console.log(`📅 Scan date: ${new Date(this.report.scanDate).toLocaleString()}`);
            return true;
        } catch (error) {
            console.log('❌ Error loading report:', error.message);
            return false;
        }
    }

    analyzeStatistics() {
        const stats = this.report.scanStats;
        const repos = this.report.highRiskRepositories;
        
        console.log('\n📊 SCAN STATISTICS OVERVIEW');
        console.log('='.repeat(50));
        console.log(`Total repositories scanned: ${stats.totalScanned}`);
        console.log(`Successful scans: ${stats.successfulScans}`);
        console.log(`High-risk findings: ${stats.highRiskFindings}`);
        console.log(`Success rate: ${((stats.highRiskFindings / stats.totalScanned) * 100).toFixed(1)}%`);

        // Risk score distribution
        const riskDistribution = { '10': 0, '9': 0, '8': 0, '7': 0, '6': 0, '5 or less': 0 };
        repos.forEach(repo => {
            const score = repo.riskScore;
            if (score === 10) riskDistribution['10']++;
            else if (score === 9) riskDistribution['9']++;
            else if (score === 8) riskDistribution['8']++;
            else if (score === 7) riskDistribution['7']++;
            else if (score === 6) riskDistribution['6']++;
            else riskDistribution['5 or less']++;
        });

        console.log('\n🎯 RISK SCORE DISTRIBUTION');
        console.log('─'.repeat(30));
        Object.entries(riskDistribution).forEach(([score, count]) => {
            const percentage = ((count / repos.length) * 100).toFixed(1);
            const bar = '█'.repeat(Math.round((count / repos.length) * 20));
            console.log(`Score ${score}: ${count} repos ${bar} (${percentage}%)`);
        });
    }

    analyzeVulnerabilityTypes() {
        const repos = this.report.highRiskRepositories;
        
        const vulnTypes = {};
        repos.forEach(repo => {
            const vuln = repo.vulnerability;
            vulnTypes[vuln] = (vulnTypes[vuln] || 0) + 1;
        });

        console.log('\n🦠 VULNERABILITY TYPE BREAKDOWN');
        console.log('─'.repeat(40));
        Object.entries(vulnTypes).forEach(([vuln, count]) => {
            const percentage = ((count / repos.length) * 100).toFixed(1);
            console.log(`${vuln}: ${count} repos (${percentage}%)`);
        });
    }

    analyzeRepositorySources() {
        const repos = this.report.highRiskRepositories;
        
        const sources = {};
        repos.forEach(repo => {
            // Extract source from repository name (e.g., "user/openzeppelin-contracts" -> "openzeppelin")
            const source = repo.repository.split('/')[1];
            sources[source] = (sources[source] || 0) + 1;
        });

        console.log('\n🏢 REPOSITORY SOURCE ANALYSIS');
        console.log('─'.repeat(35));
        Object.entries(sources)
            .sort((a, b) => b[1] - a[1])
            .forEach(([source, count]) => {
                const percentage = ((count / repos.length) * 100).toFixed(1);
                console.log(`${source}: ${count} repos (${percentage}%)`);
            });
    }

    analyzeActivityTimeline() {
        const repos = this.report.highRiskRepositories;
        
        const months = {};
        repos.forEach(repo => {
            const date = new Date(repo.lastUpdated);
            const monthYear = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
            months[monthYear] = (months[monthYear] || 0) + 1;
        });

        console.log('\n📅 ACTIVITY TIMELINE');
        console.log('─'.repeat(30));
        Object.entries(months)
            .sort()
            .forEach(([month, count]) => {
                console.log(`${month}: ${count} repos updated`);
            });
    }

    analyzePopularityMetrics() {
        const repos = this.report.highRiskRepositories;
        
        const starredRepos = repos.filter(repo => repo.stars > 0);
        const forkedRepos = repos.filter(repo => repo.forks > 0);
        
        const avgStars = starredRepos.reduce((sum, repo) => sum + repo.stars, 0) / Math.max(starredRepos.length, 1);
        const avgForks = forkedRepos.reduce((sum, repo) => sum + repo.forks, 0) / Math.max(forkedRepos.length, 1);

        console.log('\n⭐ POPULARITY METRICS');
        console.log('─'.repeat(25));
        console.log(`Repos with stars: ${starredRepos.length} (${((starredRepos.length / repos.length) * 100).toFixed(1)}%)`);
        console.log(`Repos with forks: ${forkedRepos.length} (${((forkedRepos.length / repos.length) * 100).toFixed(1)}%)`);
        console.log(`Average stars (starred repos): ${avgStars.toFixed(1)}`);
        console.log(`Average forks (forked repos): ${avgForks.toFixed(1)}`);
        
        // Top starred repos
        const topStarred = repos
            .filter(repo => repo.stars > 0)
            .sort((a, b) => b.stars - a.stars)
            .slice(0, 5);
        
        if (topStarred.length > 0) {
            console.log('\n🏆 TOP STARRED REPOSITORIES');
            console.log('─'.repeat(35));
            topStarred.forEach((repo, index) => {
                console.log(`${index + 1}. ${repo.repository} - ${repo.stars} stars (Risk: ${repo.riskScore}/10)`);
            });
        }
    }

    showTopFindings() {
        const repos = this.report.highRiskRepositories
            .sort((a, b) => b.riskScore - a.riskScore)
            .slice(0, 10);

        console.log('\n🚨 TOP 10 HIGHEST RISK FINDINGS');
        console.log('='.repeat(60));
        
        repos.forEach((repo, index) => {
            console.log(`\n${index + 1}. ${repo.repository}`);
            console.log(`   🔗 ${repo.url}`);
            console.log(`   💀 Risk Score: ${repo.riskScore}/10`);
            console.log(`   🎯 Vulnerability: ${repo.vulnerability}`);
            console.log(`   ⭐ Stars: ${repo.stars} | 🍴 Forks: ${repo.forks}`);
            console.log(`   📅 Last Updated: ${new Date(repo.lastUpdated).toLocaleDateString()}`);
            console.log(`   📝 Reason: ${repo.reason}`);
            console.log('   '.padEnd(50, '─'));
        });
    }

    generateActionableInsights() {
        const repos = this.report.highRiskRepositories;
        
        console.log('\n💡 ACTIONABLE INSIGHTS & RECOMMENDATIONS');
        console.log('='.repeat(55));

        // Insight 1: Most common vulnerability
        const vulnCounts = {};
        repos.forEach(repo => {
            vulnCounts[repo.vulnerability] = (vulnCounts[repo.vulnerability] || 0) + 1;
        });
        const topVuln = Object.entries(vulnCounts).sort((a, b) => b[1] - a[1])[0];
        
        console.log(`\n🔍 PRIMARY THREAT: ${topVuln[0]}`);
        console.log(`   Found in ${topVuln[1]} repositories (${((topVuln[1] / repos.length) * 100).toFixed(1)}% of findings)`);

        // Insight 2: Most active source
        const sourceCounts = {};
        repos.forEach(repo => {
            const source = repo.repository.split('/')[1];
            sourceCounts[source] = (sourceCounts[source] || 0) + 1;
        });
        const topSource = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])[0];
        
        console.log(`\n🏢 PRIMARY SOURCE: ${topSource[0]}`);
        console.log(`   ${topSource[1]} vulnerable forks detected`);

        // Insight 3: Recency analysis
        const recentRepos = repos.filter(repo => {
            const daysAgo = (new Date() - new Date(repo.lastUpdated)) / (1000 * 60 * 60 * 24);
            return daysAgo <= 30;
        });
        
        console.log(`\n📅 RECENT ACTIVITY: ${recentRepos.length} repos updated in last 30 days`);
        console.log(`   ${((recentRepos.length / repos.length) * 100).toFixed(1)}% of findings are recently active`);

        // Insight 4: Popular repos at risk
        const popularRepos = repos.filter(repo => repo.stars >= 2);
        console.log(`\n⭐ POPULAR TARGETS: ${popularRepos.length} repos with 2+ stars`);
        if (popularRepos.length > 0) {
            console.log(`   These represent higher-impact targets for exploitation`);
        }

        console.log(`\n🎯 PRIORITIZATION STRATEGY:`);
        console.log(`   1. Focus on ${topVuln[0]} vulnerabilities first`);
        console.log(`   2. Investigate ${topSource[0]} forks (highest concentration)`);
        console.log(`   3. Target recent activity (last 30 days)`);
        console.log(`   4. Check popular repos (potential real-world impact)`);
    }

    runFullAnalysis() {
        console.log('🕵️ STARTING COMPREHENSIVE REPORT ANALYSIS');
        console.log('='.repeat(55));
        
        if (!this.loadLatestReport()) {
            return;
        }

        this.analyzeStatistics();
        this.analyzeVulnerabilityTypes();
        this.analyzeRepositorySources();
        this.analyzeActivityTimeline();
        this.analyzePopularityMetrics();
        this.showTopFindings();
        this.generateActionableInsights();

        console.log('\n✅ ANALYSIS COMPLETE!');
        console.log('Next: Use these insights to prioritize manual verification.');
    }
}

// Run the analysis
const analyzer = new ReportAnalyzer();
analyzer.runFullAnalysis();
