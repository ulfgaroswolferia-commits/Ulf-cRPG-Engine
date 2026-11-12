import { describe, expect, it } from 'vitest';
import { CrpgGameState, detectLogSeverity } from '../../src/rpg/gameLoop';

describe('chronicleLog - Dedicated Chronicle & Combat Log Separation', () => {
  it('detects correct severity from log message content', () => {
    expect(detectLogSeverity('⚔️ Walka z: Wilk cmentarny')).toBe('combat');
    expect(detectLogSeverity('📜 Raport z walki: Zwycięstwo nad Wilk')).toBe('combat');
    expect(detectLogSeverity('🏆 Pokonano przeciwnika: Pradawny Bies!')).toBe('important');
    expect(detectLogSeverity('🛒 Zakupiono u kupca: Miecz')).toBe('important');
    expect(detectLogSeverity('Zadanie ukończone: Odnaleziono zaginiony artefakt')).toBe('important');
    expect(detectLogSeverity('Awansowałeś na nowy poziom! Zdobyto 3 punkty cech.')).toBe('important');
    expect(detectLogSeverity('☠️ Porażka w starciu z potworem!')).toBe('critical');
    expect(detectLogSeverity('Zbadano kafel terenu.')).toBe('info');
  });

  it('records chronicle entries with severity and timestamp while keeping logs string array in sync', () => {
    const game = new CrpgGameState('forest_clearing');
    game.addLog('Testowy wpis eksploracji', 'info');
    game.addLog('Odnaleziono pradawny skarb!', 'important');

    expect(game.logs[0]).toBe('Odnaleziono pradawny skarb!');
    expect(game.chronicleEntries[0].text).toBe('Odnaleziono pradawny skarb!');
    expect(game.chronicleEntries[0].severity).toBe('important');
    expect(game.lastLogSeverity).toBe('important');
  });

  it('separates detailed combat rolls from Chronicle, leaving only concise fight and report headers in Chronicle', () => {
    const game = new CrpgGameState('forest_clearing');
    const enemy = game.npcs.find((n) => n.id === 'enemy_bandit_easy');
    expect(enemy).toBeDefined();
    if (!enemy) return;

    // Place player adjacent and start combat
    game.player.tileX = enemy.tileX - 1;
    game.player.tileY = enemy.tileY;
    game.player.x = game.player.tileX + 0.5;
    game.player.y = game.player.tileY + 0.5;

    const initialChronicleCount = game.chronicleEntries.length;
    game.startCombatWithEnemy(enemy.id);

    // Chronicle should have "Walka z: "
    expect(game.chronicleEntries[0].text).toContain('Walka z:');
    expect(game.chronicleEntries[0].severity).toBe('combat');
    expect(game.chronicleEntries.length).toBe(initialChronicleCount + 1);

    // Perform an attack
    const res = game.performPlayerCombatAttack(enemy.id, 'quick', () => 0.05);
    expect(res).not.toBeNull();

    // Chronicle should NOT have been flooded with the detailed attack roll / damage
    expect(game.chronicleEntries[0].text).not.toContain('Pudło');
    expect(game.chronicleEntries[0].text).not.toContain('Trafienie!');

    // But combatLogs MUST have the detailed attack roll & damage
    expect(game.combatLogs.length).toBeGreaterThan(0);
    expect(game.combatLogs[0]).toMatch(/Trafienie|Pudło|KRYTYK/);

    // Also active combat report must contain the log
    expect(game.activeCombatReportId).toBeDefined();
    if (game.activeCombatReportId) {
      const report = game.combatReports[game.activeCombatReportId];
      expect(report).toBeDefined();
      expect(report.entries.some((e) => e.includes('Trafienie') || e.includes('Pudło') || e.includes('KRYTYK'))).toBe(true);
    }
  });

  it('renders prominent markers for important events and expanded footer with bottom-right Zwiń button', async () => {
    const { IsoSceneView } = await import('../../src/renderer/isoSceneView');
    const { HudOverlay } = await import('../../src/ui/hudOverlay');

    const game = new CrpgGameState('forest_clearing');
    // Add multiple events to test expanded capacity before collapse
    for (let i = 1; i <= 12; i++) {
      game.addLog(`Zwykły wpis eksploracji ${i}`, 'info');
    }
    // Add an important event
    game.addLog('🏆 Zdobyto legendarny Skarb Wilczego Lasu!', 'important');

    const scene = new IsoSceneView(game);
    const fakeRoot = {
      innerHTML: '',
      querySelectorAll: () => [],
      querySelector: () => null
    } as unknown as HTMLElement;

    const hud = new HudOverlay(fakeRoot, game, scene);
    hud.render();

    // Collapsed chronicle should show more than 6 entries (up to 16)
    expect(fakeRoot.innerHTML).toContain('Zwykły wpis eksploracji 1');
    expect(fakeRoot.innerHTML).toContain('Zwykły wpis eksploracji 10');
    // Important event should have prominent badge and star bullet
    expect(fakeRoot.innerHTML).toContain('log-badge-important');
    expect(fakeRoot.innerHTML).toContain('WAŻNE');
    expect(fakeRoot.innerHTML).toContain('log-bullet-important');
    expect(fakeRoot.innerHTML).toContain('⭐');
    expect(fakeRoot.innerHTML).toContain('chronicle-header-badge important');

    // When chronicle is expanded, Zwiń button must be at the bottom in chronicle-footer
    hud.toggleChronicleExpanded();
    expect(fakeRoot.innerHTML).toContain('chronicle-log expanded');
    expect(fakeRoot.innerHTML).toContain('chronicle-footer');
    expect(fakeRoot.innerHTML).toContain('chronicle-collapse-btn-bottom');
    expect(fakeRoot.innerHTML).toContain('collapse-red');
    expect(fakeRoot.innerHTML).toContain('▼ Zwiń');
  });
});
