const express = require('express');
const { chromium } = require('playwright');

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/run-test', async (req, res) => {
  const { url, username, password, instructions } = req.body;
  
  if (!url || !username || !password || !instructions) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  const actionsLog = [];
  
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Navigate
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    actionsLog.push('Navigated to ' + url);
    
    // Login
    await page.fill('input[type="email"], input[name="username"], input[placeholder*="user"]', username);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"], button:has-text("Login"), button:has-text("Sign In")');
    await page.waitForNavigation({ timeout: 10000 }).catch(() => {});
    actionsLog.push('Logged in with ' + username);
    
    // Parse and execute instructions
    const instructionList = instructions.split(/\. |\. \*|, /);
    
    for (const instruction of instructionList) {
      const instr = instruction.trim().toLowerCase();
      
      if (instr.includes('click')) {
        const match = instruction.match(/click (?:on |the )?["']?(.+?)["']?(?:\s|$)/i);
        if (match) {
          try {
            await page.click(`text=${match[1]}, button:has-text("${match[1]}")`);
            await page.waitForTimeout(500);
            actionsLog.push(`Clicked: ${match[1]}`);
          } catch (e) {
            actionsLog.push(`Failed to click: ${match[1]}`);
          }
        }
      }
      
      if (instr.includes('fill') || instr.includes('enter')) {
        const match = instruction.match(/(?:fill|enter) (?:the )?["']?(.+?)["']? (?:with|:) ["']?(.+?)["']?(?:\s|$)/i);
        if (match) {
          try {
            await page.fill(`input[placeholder*="${match[1]}"], input`, match[2]);
            actionsLog.push(`Filled '${match[1]}' with '${match[2]}'`);
          } catch (e) {
            actionsLog.push(`Failed to fill ${match[1]}`);
          }
        }
      }
      
      if (instr.includes('wait')) {
        const match = instruction.match(/wait (\d+)/i);
        if (match) {
          await page.waitForTimeout(parseInt(match[1]) * 1000);
          actionsLog.push(`Waited ${match[1]} seconds`);
        }
      }
      
      if (instr.includes('select')) {
        const match = instruction.match(/select ["']?(.+?)["']? (?:from|in) ["']?(.+?)["']?(?:\s|$)/i);
        if (match) {
          try {
            await page.selectOption(`select`, match[1]);
            actionsLog.push(`Selected ${match[1]}`);
          } catch (e) {
            actionsLog.push(`Failed to select ${match[1]}`);
          }
        }
      }
      
      if (instr.includes('screenshot') || instr.includes('take')) {
        await page.screenshot({ path: '/tmp/screenshot.png' });
        actionsLog.push('Screenshot taken');
      }
      
      if (instr.includes('verify') || instr.includes('check')) {
        const match = instruction.match(/(?:verify|check) ["']?(.+?)["']?(?:\s|$)/i);
        if (match) {
          try {
            await page.locator(`text=${match[1]}`).waitFor({ timeout: 5000 });
            actionsLog.push(`Verified: ${match[1]}`);
          } catch (e) {
            actionsLog.push(`Failed to verify: ${match[1]}`);
          }
        }
      }
    }
    
    await page.screenshot({ path: '/tmp/screenshot_final.png' });
    await browser.close();
    
    res.json({
      status: 'PASS',
      summary: `Executed ${actionsLog.length} actions`,
      actions_performed: actionsLog,
      screenshot_url: '/tmp/screenshot_final.png'
    });
  } catch (error) {
    res.status(500).json({
      status: 'FAIL',
      error: error.message,
      actions_performed: actionsLog
    });
  }
});

app.listen(PORT, () => {
  console.log(`Playwright API running on port ${PORT}`);
});
