// German dialogue for NPCs. Functions get the game and may have side effects (healing, shop).
export const DIALOG = {
  elder(g) {
    const f = g.flags, p = g.player;
    if (f.crystal) return [
      'Bodo: Du hast den Drift-Kristall zurückgebracht!',
      'Spürst du es? Der Boden unter Driftwald ist wieder ruhig. Das Dorf treibt nicht mehr davon.',
      'Ich bin so stolz auf dich. Ganz Driftwald steht in deiner Schuld!',
    ];
    if (!f.intro) {
      g.setFlag('intro', true);
      return [
        'Bodo: Ah, endlich bist du wach!',
        'Letzte Nacht ist etwas Schreckliches passiert: Der Drift-Kristall wurde aus dem Schrein gestohlen!',
        'Ohne den Kristall verliert Driftwald seinen Halt. Unser kleines Dorf treibt langsam davon …',
        'Die Spuren führen nach Osten, über die Brücke und hinauf zur alten Steinwacht-Ruine.',
        'Dort haust ein Golem aus lebendigem Fels. Nimm dein Schwert und hol den Kristall zurück!',
        'Schwert: Leertaste/J – gedrückt halten für die Wirbelattacke. Heben, Lesen, Reden: E/K.',
      ];
    }
    const lines = [];
    if (p.hp < p.maxHp) { p.hp = p.maxHp; g.play('heal'); lines.push('Bodo: Du bist verletzt. Komm her, ich versorge deine Wunden.', '(Deine Herzen sind wieder voll.)'); }
    if (f.bombs_found) lines.push('Bodo: Bomben? Damit kannst du rissige Wände sprengen. An den Nordklippen soll es so eine geben.');
    else lines.push('Bodo: Die Steinwacht-Ruine liegt im Nordosten, hoch oben auf den Klippen. Folge dem Weg über die Brücke.');
    return lines;
  },
  girl(g) {
    if (g.flags.crystal) return ['Mia: Du hast den Golem besiegt?! Wenn ich groß bin, werde ich auch Abenteurerin!'];
    const n = (g.flags._mia = (g.flags._mia || 0) + 1);
    if (n % 3 === 1) return ['Mia: Hast du das hohe Gras gesehen? Mit dem Schwert kannst du es mähen.', 'Manchmal versteckt sich darin eine Rupie oder ein Herz!'];
    if (n % 3 === 2) return ['Mia: Opa Bodo sagt, an den Nordklippen gibt es eine Felswand mit Rissen.', 'Was da wohl dahinter steckt …?'];
    return ['Mia: Von einer Klippenkante kannst du einfach hinunterspringen.', 'Hinauf kommst du aber nur über Treppen!'];
  },
  merchant(g) {
    const p = g.player;
    if (!p.hasBombs) return [
      'Lutz: Willkommen in meinem Laden! Leider sind die Regale leer.',
      'Seit der Golem in der Ruine wütet, trauen sich die Händler aus dem Osten nicht mehr her.',
    ];
    if (p.bombs >= p.maxBombs) return ['Lutz: Deine Bombentasche ist schon randvoll!'];
    if (p.rupees < 20) return ['Lutz: Bomben gefällig? 5 Stück kosten 20 Rupien.', 'Komm wieder, wenn du genug Rupien hast.'];
    p.rupees -= 20; p.bombs = Math.min(p.maxBombs, p.bombs + 5);
    g.play('buy');
    return ['Lutz: Bomben gefällig? 5 Stück für 20 Rupien.', 'Danke für deinen Einkauf! Pass auf deine Finger auf.'];
  },
  fisher(g) {
    if (g.flags.crystal) return ['Jonte: Seit der Kristall zurück ist, beißen die Fische wieder. Herrlich!'];
    return [
      'Jonte: Pssst, du verscheuchst die Fische!',
      'Die Octoroks unten am Fluss spucken Steine. Geh ihnen besser nicht direkt vor die Nase.',
      'Und im flachen Wasser kommst du nur langsam voran – merk dir das.',
    ];
  },
};
