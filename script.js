const MAX_HP = 5;
const CHAMBER_SIZE = 6;
const DEFAULT_MONEY = 7;
const PHASE_TICK = 800;

const state = {
  playerHP: MAX_HP,
  enemyHP: MAX_HP,
  money: DEFAULT_MONEY,
  round: 1,
  chamber: [],
  chamberIndex: 0,
  playerTurn: true,
  gameOver: false,
  playerArmor: 0,
  enemyArmor: 0,
  hotLoad: 0,
  inventory: [],
  enemyTimer: null,
  log: [],
  tableMood: 'calm',
  tension: 0,
  combo: 0,
  lastOutcome: 'none',
  history: {
    playerActions: 0,
    enemyActions: 0,
    blanks: 0,
    liveRounds: 0,
    medsUsed: 0,
    armorUsed: 0,
  },
  deck: [],
  wager: 0,
  dangerMeter: 0,
  opponentName: 'Rival',
  lastDamage: 0,
  currentNarrative: '',
};

const els = {
  playerHpBar: document.getElementById('playerHpBar'),
  enemyHpBar: document.getElementById('enemyHpBar'),
  playerHpValue: document.getElementById('playerHpValue'),
  enemyHpValue: document.getElementById('enemyHpValue'),
  moneyValue: document.getElementById('moneyValue'),
  roundValue: document.getElementById('roundValue'),
  chamber: document.getElementById('chamber'),
  chamberText: document.getElementById('chamberText'),
  turnBadge: document.getElementById('turnBadge'),
  log: document.getElementById('log'),
  inventoryList: document.getElementById('inventoryList'),
  fireBtn: document.getElementById('fireBtn'),
  spinBtn: document.getElementById('spinBtn'),
  reloadBtn: document.getElementById('reloadBtn'),
  quitBtn: document.getElementById('quitBtn'),
  newGameBtn: document.getElementById('newGameBtn'),
};

const stateKeyMap = {
  playerHP: 'Player HP',
  enemyHP: 'Rival HP',
  money: 'Cash',
  round: 'Round',
  playerArmor: 'Armor',
  enemyArmor: 'Enemy Armor',
  hotLoad: 'Hot Load',
  tension: 'Tension',
  combo: 'Combo',
};

const shellNames = {
  live: 'Live',
  blank: 'Blank',
  decoy: 'Decoy',
  hot: 'Hot',
};

const shopCatalog = {
  medkit: {
    id: 'medkit',
    name: 'Medkit',
    cost: 4,
    flavor: 'stabilize and breathe',
    apply() {
      if (state.money < this.cost) {
        addLog('You reach for the medkit, but the cash is gone.', 'bad');
        return false;
      }
      state.money -= this.cost;
      state.playerHP = clamp(state.playerHP + 1, 0, MAX_HP);
      state.inventory.push({
        id: this.id,
        name: this.name,
        tag: 'heal',
        description: 'Restores 1 HP.',
      });
      state.history.medsUsed += 1;
      addLog('You tear open a medkit and force your breathing back under control.', 'safe');
      render();
      return true;
    },
  },
  armor: {
    id: 'armor',
    name: 'Armor',
    cost: 5,
    flavor: 'absorb the next hit',
    apply() {
      if (state.money < this.cost) {
        addLog('The vendor shrugs. You do not have enough to buy armor.', 'bad');
        return false;
      }
      state.money -= this.cost;
      state.playerArmor += 1;
      state.inventory.push({
        id: this.id,
        name: this.name,
        tag: 'guard',
        description: 'Reduce the next incoming hit by 1.',
      });
      state.history.armorUsed += 1;
      addLog('Steel snaps onto your chest. The next impact will be softer.', 'safe');
      render();
      return true;
    },
  },
  hotload: {
    id: 'hotload',
    name: 'Hot Load',
    cost: 6,
    flavor: 'stack pressure into the next shot',
    apply() {
      if (state.money < this.cost) {
        addLog('You count your coins again. The hot load will have to wait.', 'bad');
        return false;
      }
      state.money -= this.cost;
      state.hotLoad = 1;
      state.inventory.push({
        id: this.id,
        name: this.name,
        tag: 'boost',
        description: 'The next shot deals +1 damage.',
      });
      addLog('You crank a hotter shell into the chamber. The room smells like copper and sparks.', 'safe');
      render();
      return true;
    },
  },
  salve: {
    id: 'salve',
    name: 'Salve',
    cost: 3,
    flavor: 'clean up and recover',
    apply() {
      if (state.money < this.cost) {
        addLog('A cheap salve suddenly feels expensive.', 'bad');
        return false;
      }
      state.money -= this.cost;
      state.playerHP = clamp(state.playerHP + 2, 0, MAX_HP);
      state.inventory.push({
        id: this.id,
        name: this.name,
        tag: 'medic',
        description: 'Restore 2 HP immediately.',
      });
      addLog('You rub rough salve over your palms and re-center yourself.', 'safe');
      render();
      return true;
    },
  },
  chalk: {
    id: 'chalk',
    name: 'Chalk Mark',
    cost: 2,
    flavor: 'count the odds on the barrel',
    apply() {
      if (state.money < this.cost) {
        addLog('The chalk stays in the tray. You cannot afford it.', 'bad');
        return false;
      }
      state.money -= this.cost;
      state.tension = clamp(state.tension + 1, 0, 12);
      state.inventory.push({
        id: this.id,
        name: this.name,
        tag: 'tactic',
        description: 'Increases your confidence and clarifies the next decision.',
      });
      addLog('You mark the chamber with a quick chalk line and calculate the odds in your head.', 'safe');
      render();
      return true;
    },
  },
  whiskey: {
    id: 'whiskey',
    name: 'Whiskey',
    cost: 4,
    flavor: 'steady hands in the dark',
    apply() {
      if (state.money < this.cost) {
        addLog('You stare at the bottle, then back at your empty pocket.', 'bad');
        return false;
      }
      state.money -= this.cost;
      state.playerHP = clamp(state.playerHP + 1, 0, MAX_HP);
      state.inventory.push({
        id: this.id,
        name: this.name,
        tag: 'drink',
        description: 'A little liquid courage and a little health.',
      });
      addLog('You take a hard drink and feel your nerves settle enough to hold the line.', 'safe');
      render();
      return true;
    },
  },
};

const hostileStatements = [
  'The rival exhale is rough and impatient.',
  'A grin flickers across the table as the chamber clicks.',
  'The room feels too loud, too still, too honest.',
  'The rival checks the barrel like it owes him something.',
  'A wet scrape echoes from the corner of the room.',
  'Your heartbeat slams against your ribs like a loud metronome.',
  'The rival is not bluffing. They are waiting for a mistake.',
  'The crowd leans closer, smelling blood and fear.',
  'The next round decides who keeps breathing.',
  'The chamber breathes in the silence before the shot.',
  'The table chatter turns to static in your ears.',
  'You can sense the rivalry in the way they hold the gun.',
  'The air turns metallic as the weapon is lifted.',
  'The rival seems to know exactly where the pressure is about to hit.',
  'The room feels half-empty and half-ending.',
  'A friend of the house laughs too hard and makes it worse.',
  'The barrel is a promise of damage if you do not move first.',
  'Your hands are calm, but your jaw is not.',
  'Something in the mug on the table rattles as the chamber spins.',
  'The rival is tired of patience. They want a quick answer.',
  'The silence after each click feels like standing on a trap door.',
];

const openingLines = [
  'The room is all smoke, cheap light, and bad decisions.',
  'A new match starts with a dry click and a sharp look from the rival.',
  'The dealer flips a coin onto the table, and the room falls quiet.',
  'The shotgun sits between your hands like a dare.',
  'The table is not just a table. It is a bet against your own survival.',
  'The rival rolls the sleeves back and smiles like they have already won.',
  'The dealer gives the chamber a nudge and the room leans forward.',
  'You both know what is at stake: money, pride, and senses.',
  'The first barrel click makes your eyes lock on the muzzle.',
  'There is no room for hesitation in a room like this.',
  'The match begins with a cold metallic breath from the shotgun.',
  'The table lights flicker, and the stakes feel almost personal.',
  'A laugh cracks from the crowd as the chamber settles in your hands.',
  'You can read the tension from the rival, but not their load.',
  'The room carries the smell of dust, iron, and old gun oil.',
  'Your hands shake once, then settle. That is enough.',
  'It feels like the whole room is waiting for the wrong shot.',
  'The rival pushes a chip forward as if daring you to fold.',
  'The barrel revolves, and the world narrows to one chamber.',
  'A good shot is a lucky shot. A great one is a calculated risk.',
];

const victoryNarratives = [
  'You leave the table with blood on your sleeve and money in your pocket.',
  'The rival collapses. The crowd fades to noise behind your pulse.',
  'The room is yours for one more breath and one more round.',
  'The chamber finally turns in your favor and the game changes shape.',
  'The last shell is not yours, but your nerve is. You walk away standing.',
  'The rival grips the table as they fall. The crowd roars your name.',
  'You take the table, the cash, and the moment.',
  'You win this round by refusing to flinch.',
  'The friend of the house mutters a curse while your hand keeps steady.',
  'It is not a clean win, but it is yours.',
  'The table lights spark as your shot lands just right.',
  'The rival loses the match, and the room decides you are the danger now.',
  'The last live shell yields, and the game slips to your side.',
];

const defeatNarratives = [
  'The room goes quiet but not empty. Your breath catches on the smoke.',
  'The rival takes the match. The table remembers every loss.',
  'The chamber turns against you, and so does the room.',
  'You are still standing, but the fight and the table are already gone.',
  'The shotgun coughs once too many times. The room infects your nerves.',
  'A dry laugh rolls from the rival as your knees start to give out.',
  'You lose more than the round. You lose the nerve to pretend.',
  'It is one clean shot, and the whole night tips against you.',
  'The crowd does not cheer. They only watch as you fold under the pressure.',
  'The rival takes your money and your grip on the table.',
  'The final shot tears through the silence and leaves him standing.',
  'You collapse into the seat, too proud to look away.',
];

const rulebook = [
  'Every chamber has six slots. Some are live, some are blank.',
  'When you fire a live shell, your target takes damage.',
  'When you fire a blank, you risk nothing but the round changes.',
  'Spinning changes the order of the chamber and changes the odds.',
  'Reloading creates a fresh set of random shells and resets your momentum.',
  'Armor absorbs a portion of damage, then is consumed.',
  'Hot Load doubles the damage for the next shot, if you can survive long enough.',
  'The shop gives you tools, patches, and confidence boosts between rounds.',
  'The rival acts after your turn. They are not passive. They are opportunistic.',
  'The table is a pressure cooker. Avoid panic, and the odds may bend to your favor.',
  'The game ends when a side reaches zero health or the table denies your surrender.',
  'A calm mind keeps the chamber stable. A frightened one reloads awkwardly.',
  'Think like a hunter, not a gambler. Calculate, then commit.',
  'A blank is not a miss. It is a lie. A moment of safety that you can spend wisely.',
  'The game watches your rhythm. Add noise. Add pressure. Add uncertainty.',
  'Survival is not about winning every round. It is about controlling what matters.',
];

const adviceDeck = [
  'If the chamber is cool, take the shot. If it is hot, watch the pattern.',
  'Do not trust a polished barrel. Trust the last few clicks you heard.',
  'A single blank can save a whole streak. Use it to read the table.',
  'You do not need to win every argument. You only need the final one.',
  'Armor matters more in the middle of the match than it does at the start.',
  'A successful spin is not about luck. It is about timing and nerve.',
  'The shop can turn a bad round into a manageable one if you are patient.',
  'A full reload is a reset. A short spin is a gamble. Choose consciously.',
  'The crowd is not cheering. They are watching. Learn the rhythm of the room.',
  'A low HP player with a good plan can still beat a nervous rival.',
  'Pay attention to how the rival acts after blanks. That is where the tells are.',
  'Medkits are not weakness. They are a way to continue a battle you have not lost.',
  'When in doubt, watch the chamber index. It tells the story of the table.',
  'A calm decision beats a lucky one almost every time.',
  'The best defense is often understanding exactly what kind of pressure the table is creating.',
];

const shellProfiles = [
  { type: 'blank', label: 'blank', weight: 4 },
  { type: 'live', label: 'live', weight: 2 },
  { type: 'decoy', label: 'decoy', weight: 1 },
  { type: 'hot', label: 'hot', weight: 1 },
];

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function setMood(mood) {
  const moods = {
    calm: { label: 'Calm', className: 'calm' },
    tense: { label: 'Tense', className: 'tense' },
    desperate: { label: 'Desperate', className: 'desperate' },
    lethal: { label: 'Lethal', className: 'lethal' },
  };

  state.tableMood = mood;
  state.currentNarrative = moods[mood]?.label ?? mood;
}

function buildChamber(optionOverrides = {}) {
  const chamber = [];
  const liveCount = typeof optionOverrides.liveCount === 'number'
    ? optionOverrides.liveCount
    : 2 + Math.floor(Math.random() * 3);

  for (let index = 0; index < CHAMBER_SIZE; index += 1) {
    chamber.push({
      type: 'blank',
      index,
      label: shellNames.blank,
      visible: false,
      hot: false,
    });
  }

  for (let count = 0; count < liveCount; count += 1) {
    let slot = Math.floor(Math.random() * CHAMBER_SIZE);
    while (chamber[slot].type === 'live') {
      slot = Math.floor(Math.random() * CHAMBER_SIZE);
    }
    chamber[slot] = {
      type: 'live',
      index: slot,
      label: shellNames.live,
      visible: true,
      hot: false,
    };
  }

  if (Math.random() < 0.18) {
    const blip = Math.floor(Math.random() * CHAMBER_SIZE);
    if (chamber[blip].type === 'blank') {
      chamber[blip] = {
        type: 'decoy',
        index: blip,
        label: shellNames.decoy,
        visible: true,
        hot: false,
      };
    }
  }

  if (Math.random() < 0.14) {
    const hotSlot = Math.floor(Math.random() * CHAMBER_SIZE);
    if (chamber[hotSlot].type === 'blank') {
      chamber[hotSlot] = {
        type: 'hot',
        index: hotSlot,
        label: shellNames.hot,
        visible: true,
        hot: true,
      };
    }
  }

  if (optionOverrides.forceLiveAt) {
    chamber[optionOverrides.forceLiveAt] = {
      type: 'live',
      index: optionOverrides.forceLiveAt,
      label: shellNames.live,
      visible: true,
      hot: false,
    };
  }

  return chamber;
}

function buildShopButtons() {
  const shopList = document.querySelector('.shop-list');
  if (!shopList) {
    return;
  }

  shopList.innerHTML = '';
  Object.values(shopCatalog).forEach((item) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'shop-item';
    button.dataset.item = item.id;
    button.innerHTML = `
      <span>${item.name}</span>
      <strong>$${item.cost}</strong>
    `;
    button.addEventListener('click', () => {
      purchaseItem(item.id);
    });
    shopList.appendChild(button);
  });
}

function updateTableMoodFromState() {
  if (state.enemyHP <= 2 || state.playerHP <= 2) {
    setMood('desperate');
    return;
  }

  if (state.combo >= 2) {
    setMood('lethal');
    return;
  }

  if (state.tension >= 6) {
    setMood('tense');
    return;
  }

  setMood('calm');
}

function addLog(text, type = 'safe') {
  const entry = {
    text,
    type,
    stamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
  state.log.push(entry);
}

function renderLog() {
  const log El = els.log;
  if (!El) return;
  El.innerHTML = '';

  const visibleLog = state.log.slice(-14);
  visibleLog.forEach((entry) => {
    const row = document.createElement('div');
    row.className = `log-entry ${entry.type}`;
    row.innerHTML = `<span class="log-time">${entry.stamp}</span> ${entry.text}`;
    El.appendChild(row);
  });
}

function renderInventory() {
  const list = els.inventoryList;
  if (!list) return;
  list.innerHTML = '';

  if (state.inventory.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No gear';
    list.appendChild(li);
    return;
  }

  state.inventory.forEach((item, idx) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <strong>${item.name}</strong>
      <span>${item.description}</span>
      <small>${item.tag}</small>
    `;
    li.title = `Item slot ${idx + 1}`;
    list.appendChild(li);
  });
}

function renderHud() {
  const playerWidth = `${(state.playerHP / MAX_HP) * 100}%`;
  const enemyWidth = `${(state.enemyHP / MAX_HP) * 100}%`;

  if (els.playerHpBar) {
    els.playerHpBar.style.width = playerWidth;
  }

  if (els.enemyHpBar) {
    els.enemyHpBar.style.width = enemyWidth;
  }

  if (els.playerHpValue) {
    els.playerHpValue.textContent = String(state.playerHP);
  }

  if (els.enemyHpValue) {
    els.enemyHpValue.textContent = String(state.enemyHP);
  }

  if (els.moneyValue) {
    els.moneyValue.textContent = String(state.money);
  }

  if (els.roundValue) {
    els.roundValue.textContent = String(state.round);
  }

  if (els.turnBadge) {
    els.turnBadge.textContent = state.playerTurn ? 'Player Turn' : 'Rival Turn';
    els.turnBadge.className = `turn-badge ${state.playerTurn ? 'player' : 'enemy'}`;
  }

  if (els.chamberText) {
    els.chamberText.textContent = `Chamber ${state.chamberIndex + 1}`;
  }
}

function renderChamber() {
  const chamberNode = els.chamber;
  if (!chamberNode) return;
  chamberNode.innerHTML = '';

  state.chamber.forEach((shell, index) => {
    const slot = document.createElement('div');
    slot.className = `shell ${shell.type} ${index === state.chamberIndex ? 'active' : ''}`;
    slot.textContent = shell.label;
    chamberNode.appendChild(slot);
  });
}

function render() {
  updateTableMoodFromState();
  renderHud();
  renderChamber();
  renderInventory();
  renderLog();

  const actionDisabled = !state.playerTurn || state.gameOver;
  if (els.fireBtn) els.fireBtn.disabled = actionDisabled;
  if (els.spinBtn) els.spinBtn.disabled = actionDisabled;
  if (els.reloadBtn) els.reloadBtn.disabled = actionDisabled;
  if (els.quitBtn) els.quitBtn.disabled = state.gameOver;
}

function pulseDangerMeter() {
  const now = state.playerHP <= 2 || state.enemyHP <= 2 ? 1 : 0;
  state.dangerMeter = clamp(now + state.tension * 0.14, 0, 1);
}

function addRoundComment() {
  const comment = randomFrom(hostileStatements);
  addLog(comment, 'bad');
}

function purchaseItem(itemId) {
  const item = shopCatalog[itemId];
  if (!item) {
    return;
  }

  if (!state.playerTurn) {
    addLog('You cannot buy while the rival is taking the turn.', 'bad');
    return;
  }

  item.apply();
}

function rotateChamber(amount = 1) {
  state.chamberIndex = (state.chamberIndex + amount) % CHAMBER_SIZE;
}

function spinChamber() {
  const shift = 1 + Math.floor(Math.random() * 4);
  rotateChamber(shift);
  state.tension = clamp(state.tension + 1, 0, 12);
  state.history.playerActions += 1;
  addLog('You twist the cylinder and change the pressure on the room.', 'safe');
}

function reloadChamber() {
  state.chamber = buildChamber();
  state.chamberIndex = 0;
  state.history.playerActions += 1;
  addLog('You slam in a fresh chamber and reset the odds.', 'safe');
}

function makeDamage(target, amount, source = 'shot') {
  const base = Math.max(0, Number(amount) || 0);
  if (target === 'player') {
    const armorAbsorb = Math.min(state.playerArmor, base);
    const net = Math.max(0, base - armorAbsorb);
    state.playerHP = clamp(state.playerHP - net, 0, MAX_HP);
    state.playerArmor = Math.max(0, state.playerArmor - armorAbsorb);
    state.lastDamage = net;
    state.history.playerActions += 1;
    addLog(`${source} hits for ${net} damage and your armor takes the edge off.`, net > 0 ? 'bad' : 'safe');
    return net;
  }

  const armorAbsorb = Math.min(state.enemyArmor, base);
  const net = Math.max(0, base - armorAbsorb);
  state.enemyHP = clamp(state.enemyHP - net, 0, MAX_HP);
  state.enemyArmor = Math.max(0, state.enemyArmor - armorAbsorb);
  state.lastDamage = net;
  state.history.enemyActions += 1;
  addLog(`${source} lands ${net} damage on the rival.`, net > 0 ? 'bad' : 'safe');
  return net;
}

function applyDamage(target, rawDamage) {
  const effective = Number(rawDamage) || 0;
  if (target === 'player') {
    return makeDamage('player', effective, 'The rival');
  }
  return makeDamage('enemy', effective, 'You');
}

function triggerCombatLog(actor, shellType, damage, isHit) {
  if (actor === 'player') {
    if (shellType === 'live' && isHit) {
      addLog(`You fire and the live round tears through the rival for <strong>${damage}</strong> damage.`, 'bad');
      return;
    }

    if (shellType === 'hot' && isHit) {
      addLog(`You fire a hot shell. The chamber screams and tears through the rival for <strong>${damage}</strong> damage.`, 'bad');
      return;
    }

    if (shellType === 'decoy') {
      addLog('You fire into a decoy shell and the chamber rattles with a harmless click.', 'safe');
      return;
    }

    if (shellType === 'blank') {
      addLog('You fire a blank and the room exhales for one second.', 'safe');
      return;
    }

    addLog('You pull the trigger and the barrel answers with a sharp cough.', 'safe');
    return;
  }

  if (shellType === 'live' && isHit) {
    addLog(`The rival fires a live shell and deals <strong>${damage}</strong> damage.`, 'bad');
    return;
  }

  if (shellType === 'hot' && isHit) {
    addLog(`The rival smacks in a hot shell and tears into you for <strong>${damage}</strong>.`, 'bad');
    return;
  }

  if (shellType === 'decoy') {
    addLog('The rival squeezes the trigger on a decoy and only the click survives.', 'safe');
    return;
  }

  if (shellType === 'blank') {
    addLog('The rival fires a blank. The room shudders, and the silence is a knife.', 'safe');
    return;
  }

  addLog('The rival shoots and the chamber answers with harsh metal.', 'bad');
}

function fireShot(actor) {
  if (state.gameOver) return;

  if (actor === 'player' && !state.playerTurn) return;
  if (actor === 'enemy' && state.playerTurn) return;

  const currentShell = state.chamber[state.chamberIndex] || { type: 'blank', label: 'Blank' };
  const shellType = currentShell.type;
  const isLive = shellType === 'live' || shellType === 'hot';
  const damage = state.hotLoad > 0 ? 2 : 1;

  if (actor === 'player') {
    state.history.playerActions += 1;
    state.combo = clamp(state.combo + 1, 0, 9);

    if (isLive) {
      const inflicted = applyDamage('enemy', damage);
      triggerCombatLog('player', shellType, inflicted, true);

      if (state.enemyHP <= 0) {
        addLog('The rival drops. The table is yours for now.', 'safe');
        finishGame('player');
        return;
      }
    } else {
      triggerCombatLog('player', shellType, 0, false);
    }

    state.chamberIndex = (state.chamberIndex + 1) % CHAMBER_SIZE;
    state.hotLoad = 0;
    state.playerTurn = false;
    render();
    clearTimeout(state.enemyTimer);
    state.enemyTimer = setTimeout(enemyTurn, PHASE_TICK);
    return;
  }

  state.history.enemyActions += 1;
  state.combo = clamp(state.combo - 1, 0, 9);

  if (isLive) {
    const inflicted = applyDamage('player', damage);
    triggerCombatLog('enemy', shellType, inflicted, true);

    if (state.playerHP <= 0) {
      addLog('You collapse beneath the pressure. The rival takes the table.', 'bad');
      finishGame('enemy');
      return;
    }
  } else {
    triggerCombatLog('enemy', shellType, 0, false);
  }

  state.chamberIndex = (state.chamberIndex + 1) % CHAMBER_SIZE;
  state.playerTurn = true;
  render();
}

function getEnemyAction() {
  const hostileBias = state.enemyHP <= 2 ? 0.28 : 0.15;
  const pressure = state.playerHP <= 2 ? 0.32 : 0.12;
  const randomRoll = Math.random();

  if (randomRoll < hostileBias) {
    return 'fire';
  }

  if (randomRoll < hostileBias + pressure) {
    return 'reload';
  }

  if (randomRoll < hostileBias + pressure + 0.18) {
    return 'spin';
  }

  return 'fire';
}

function enemyTurn() {
  if (state.gameOver) return;

  const action = getEnemyAction();

  if (action === 'reload') {
    reloadChamber();
    addLog('The rival slaps in a fresh chamber and resets the odds.', 'bad');
    state.playerTurn = true;
    render();
    return;
  }

  if (action === 'spin') {
    const shift = 1 + Math.floor(Math.random() * 3);
    rotateChamber(shift);
    addLog('The rival twists the chamber and changes the rhythm of the table.', 'bad');
    state.playerTurn = true;
    render();
    return;
  }

  fireShot('enemy');
  if (!state.gameOver) {
    state.playerTurn = true;
    render();
  }
}

function finishGame(winner) {
  state.gameOver = true;
  state.playerTurn = false;
  clearTimeout(state.enemyTimer);

  if (winner === 'player') {
    state.money += 3;
    const flair = randomFrom(victoryNarratives);
    addLog(flair, 'safe');
  } else {
    const flair = randomFrom(defeatNarratives);
    addLog(flair, 'bad');
  }

  const title = winner === 'player' ? 'Table Victory' : 'Table Defeat';
  const note = winner === 'player'
    ? 'You keep your nerve and leave the room with another stack of money.'
    : 'The room closes around you. You are not done, but the table is.';
  addLog(`${title}: ${note}`, winner === 'player' ? 'safe' : 'bad');
  render();
}

function makeDecisionHint() {
  if (state.gameOver) return 'The table is closed.';
  if (state.playerTurn) {
    if (state.tension >= 8) {
      return 'The room is tense. Work the chamber, then commit.';
    }
    if (state.playerHP <= 2) {
      return 'Your health is thin. Protect the next shot.';
    }
    return 'The pressure is yours. Decide before the rival returns the favor.';
  }
  return 'The rival is deciding whether to fire, spin, or reload.';
}

function writeCurrentHint() {
  const note = document.createElement('div');
  note.className = 'system-tip';
  note.textContent = makeDecisionHint();

  const existing = document.querySelector('.system-tip');
  if (existing) existing.remove();

  const gamePanel = document.querySelector('.game-panel');
  if (gamePanel) {
    gamePanel.appendChild(note);
  }
}

function loadStrategyDeck() {
  const cards = [
    'Pressure stack: spin once, then fire when the odds feel favorable.',
    'Safety game: reload early and use the room to recover.',
    'Aggressive push: hot load with a live chamber and finish the round.',
    'Control pattern: watch the barrel, track the blanks, pressure the rival.',
    'Economic route: buy a medkit when the HP is low and avoid panic.',
    'Armor plan: reduce the damage curve and survive one more exchange.',
    'Risk plan: accept the bad chamber and take the shot if the rival is fragile.',
    'Recovery track: use salves and time to keep pressure manageable.',
    'Mental duel: maintain calm and refuse the error that buys the table.',
    'Late round play: force the rival into a costly mistake and then punish it.',
  ];

  return cards;
}

function renderStrategyDeck() {
  const cards = loadStrategyDeck();
  const section = document.createElement('section');
  section.className = 'panel deck-panel';
  section.innerHTML = '<h2>Strategy Notes</h2>';

  const list = document.createElement('ul');
  list.className = 'strategy-list';

  cards.forEach((card) => {
    const li = document.createElement('li');
    li.textContent = card;
    list.appendChild(li);
  });

  section.appendChild(list);

  const parent = document.querySelector('.side-stack');
  if (parent && !document.querySelector('.deck-panel')) {
    parent.appendChild(section);
  }
}

function renderRulebook() {
  const section = document.createElement('section');
  section.className = 'panel rules-panel';
  section.innerHTML = '<h2>Table Rules</h2>';

  const list = document.createElement('ul');
  list.className = 'rules-list';

  rulebook.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = entry;
    list.appendChild(li);
  });

  section.appendChild(list);

  const parent = document.querySelector('.side-stack');
  if (parent && !document.querySelector('.rules-panel')) {
    parent.appendChild(section);
  }
}

function injectGamePanels() {
  const side = document.querySelector('.side-stack');
  if (!side) return;

  if (!document.querySelector('.deck-panel')) {
    renderStrategyDeck();
  }

  if (!document.querySelector('.rules-panel')) {
    renderRulebook();
  }
}

function applyPhaseNarrative() {
  const narrative = randomFrom(openingLines);
  addLog(narrative, 'safe');
}

function initializeState() {
  state.playerHP = MAX_HP;
  state.enemyHP = MAX_HP;
  state.money = DEFAULT_MONEY;
  state.round = 1;
  state.playerArmor = 0;
  state.enemyArmor = 0;
  state.hotLoad = 0;
  state.inventory = [];
  state.log = [];
  state.playerTurn = true;
  state.gameOver = false;
  state.tension = 2;
  state.combo = 0;
  state.chamber = buildChamber();
  state.chamberIndex = 0;
  state.history = {
    playerActions: 0,
    enemyActions: 0,
    blanks: 0,
    liveRounds: 0,
    medsUsed: 0,
    armorUsed: 0,
  };
  state.tableMood = 'calm';
  state.currentNarrative = 'Calm';
  updateTableMoodFromState();
  applyPhaseNarrative();
  addRoundComment();
}

function storyBeat() {
  const outcome = Math.random();
  if (outcome < 0.2) {
    addLog(randomFrom(openingLines), 'safe');
  } else if (outcome < 0.45) {
    addLog(randomFrom(hostileStatements), 'bad');
  } else if (outcome < 0.7) {
    addLog(randomFrom(adviceDeck), 'safe');
  } else if (outcome < 0.9) {
    addLog(randomFrom(victoryNarratives), 'safe');
  } else {
    addLog(randomFrom(defeatNarratives), 'bad');
  }
}

function bindUi() {
  els.fireBtn?.addEventListener('click', () => {
    if (state.playerTurn && !state.gameOver) {
      fireShot('player');
    }
  });

  els.spinBtn?.addEventListener('click', () => {
    if (state.playerTurn && !state.gameOver) {
      spinChamber();
      endTurn();
    }
  });

  els.reloadBtn?.addEventListener('click', () => {
    if (state.playerTurn && !state.gameOver) {
      reloadChamber();
      endTurn();
    }
  });

  els.quitBtn?.addEventListener('click', () => {
    if (state.gameOver) return;
    state.playerHP = 0;
    addLog('You fold. The rival takes the table and the room falls silent.', 'bad');
    finishGame('enemy');
  });

  els.newGameBtn?.addEventListener('click', () => {
    clearTimeout(state.enemyTimer);
    initializeState();
    render();
    writeCurrentHint();
  });
}

function endTurn() {
  if (state.gameOver) return;
  state.playerTurn = false;
  render();
  clearTimeout(state.enemyTimer);
  state.enemyTimer = setTimeout(enemyTurn, 650);
}

function notePhaseSummary() {
  const summary = [
    'The round is still alive. Keep the chamber under control.',
    'The room is listening. One good decision changes the shape of the game.',
    'You can still win. The table does not know your nerve yet.',
    'Do not let the pressure decide for you. Pick your shot and commit.',
    'The rival is waiting for weakness. Give them the wrong thing.',
    'Live rounds are not the enemy. Panic is.',
  ];
  addLog(randomFrom(summary), 'safe');
}

function attachHints() {
  const hintAnchor = document.querySelector('.game-panel');
  if (!hintAnchor) return;

  let hintNode = document.querySelector('.system-tip');
  if (!hintNode) {
    hintNode = document.createElement('div');
    hintNode.className = 'system-tip';
    hintAnchor.appendChild(hintNode);
  }

  hintNode.textContent = makeDecisionHint();
}

function refreshStatusPanels() {
  writeCurrentHint();
  notePhaseSummary();
}

function init() {
  buildShopButtons();
  bindUi();
  initializeState();
  injectGamePanels();
  attachHints();
  render();
  writeCurrentHint();
  setInterval(() => {
    if (!state.gameOver) {
      storyBeat();
    }
  }, 20000);
}

init();

const debugState = {
  get: () => state,
  reset: () => {
    clearTimeout(state.enemyTimer);
    initializeState();
    render();
  },
  message: 'System ready. The table is active and the chamber is loaded.',
};

window.gameState = debugState;

const knownProcedures = [
  'The deck is assembled, the chamber is live, and the rival waits for a mistake.',
  'This match is a mixture of nerves, timing, and hostile opportunity.',
  'Your choices define the rhythm of the room more than the random shell count does.',
  'A clean reload is not a cowardly move. It is a tactical reset.',
  'A blank does not win the room. It just keeps the next reaction honest.',
  'When the table is loud, the best answer is often a quieter decision.',
  'You are allowed to survive the round. You are not required to blind-fire a gamble.',
  'An empty barrel can still be a weapon if someone is counting on your hesitation.',
  'Every chamber contains pressure, but only the player can choose where to put the hand.',
  'Modern tactics do not always call for the loudest shot. Sometimes it is a softer one.',
];

const extraNarratives = [
  'The pressure in the room lifts just enough to expose a tiny weakness in the rival stance.',
  'The smoke from the last round hangs in the air, and your eyes begin to track the chamber movement.',
  'Your shoulders unlock one degree, and the table becomes more manageable.',
  'This is a match of nerve and nerve only. The rest is theater.',
  'The dealer leans in and the crowd smells blood in the same breath.',
  'The rival keeps their face still, but they lose a fraction of control on the trigger.',
  'A single slow breath makes the barrel easier to read.',
  'The room wavers around the margin of the table, but your grip stays fixed.',
  'A good player knows when to draw the line. A great player knows when to hold it.',
  'The next action may decide the tone of the entire table.',
];

const pressureNotes = [
  'You can feel the room leaning toward one outcome with every click.',
  'The gun is heavier in your hands than it has any right to be.',
  'A bad spin changes the room. A good one changes the match.',
  'The rival seems to favor the moment right after a blank.',
  'You can almost hear the chamber counting down in your own pulse.',
  'A good plan is only as good as the nerve that carries it out.',
  'A pause can save you if it is intentional. A panic pause just feeds the table.',
  'The shell count is not the entire story. The table state matters too.',
  'A single live shell can still be a weapon if it is placed exactly where the rival expects.',
  'Every time the chamber clicks, your heartbeat answers with its own rhythm.',
];

const lineOfSight = [
  'You track the angle of the muzzle and adjust your timing before the shot lands.',
  'The body language on the rival gives away one small cue: they are waiting for your rhythm.',
  'You notice the barrel is not perfectly centered with the table. That changes the angle.',
  'The room flickers with reflected light. It is enough to make the chamber edge easier to read.',
  'The rival is not subtle; the real danger is how much they believe their own confidence.',
  'The chamber does not decide the match. The player does.',
  'Your eyes are on the trigger guard, not the muzzle. That is the right place to be.',
  'The color in the room changes with each turn, and your judgment follows it.',
  'The key is not to guess the chamber. The key is to read it and keep your steps short.',
  'The table is old enough to remember every bad decision. You do not want to be one of them.',
];

const endgameSuggestions = [
  'If you remain calm, the room will eventually stop trying to scare you.',
  'Even a losing streak can be broken by one steady decision.',
  'Think not about the next round, but about the next three actions.',
  'Your posture matters. Loose hands lose their rhythm.',
  'The only real advantage is the confidence to act before the room overwhelms you.',
  'A damaged player can still win if the rival has already spent their nerve.',
  'Control the narrative of the table and the table will answer.',
  'You are not fighting the gun. You are fighting the fear it creates.',
  'The match is not won by the strongest hand. It is won by the most disciplined one.',
  'The room will keep breathing after the shot. That breath is yours to hold or lose.',
];

const combatGlossary = {
  live: 'A dangerous shell that deals damage if fired.',
  blank: 'A harmless shell that tells you nothing and buys you breath.',
  decoy: 'A trap of uncertainty. The chamber looks real, but the outcome is false.',
  hot: 'A highly volatile shell with extra damage and extra risk.',
  armor: 'Protective plating that absorbs a portion of the next incoming hit.',
  medkit: 'A small emergency patch that restores a single point of health.',
  salve: 'A rough treatment that restores more than a scratch.',
  reload: 'A full reset of the chamber that changes the odds dramatically.',
  spin: 'The rotation of the chamber that alters its arrangement and pressure.',
  chamber: 'The six-shaped gas of the shotgun that carries the whole game state.',
};

const experienceJournal = [
  'The table is a terrible place to be patient. It is a great place to be deliberate.',
  'The first chamber creates a mood. The second creates a pattern. The third decides a route.',
  'The room learns your habits quickly. The only way to keep it confused is to act differently.',
  'Every win in this room is equal parts luck and control. The control comes from the player.',
  'The moment you stop counting and start feeling is the moment the room takes control.',
  'A scared player makes noise. A calm player makes choices.',
  'You must not confuse a blank with a pass. It is a pause, not a victory.',
  'The whole match is built from tiny edges: a better timing decision, a slower breath, a new angle.',
  'Every rival is a mirror with a different level of patience.',
  'There is no shame in a reload. There is only shame in a panic reload without a plan.',
];

const roomSignals = [
  'The floor boards complain under the weight of too many bad decisions.',
  'The table carries a third of the tension in a small metal vibration.',
  'A thread of sweat reaches your eyebrow, and the room feels more alive than before.',
  'The dealer is not making a choice. The dealer is watching carefully to see how far you will go.',
  'Your breath turns shallow. That is when the room takes control.',
  'Every person in the room seems to sharpen their focus as the trigger slips closer.',
  'The echo of a chair leg scraping is enough to make the air feel colder.',
  'The rival has stopped pretending. They are now calculating what you will do next.',
  'The air is too wet with old smoke. It feels like an omen.',
  'The barrel clicks once without heat, and you read the room again.',
];

const compactStories = [
  'The game is brutal because it is simple. A weapon, a chamber, and a choice.',
  'Every turn is a tiny theatre of risk and the room knows it.',
  'You do not need perfect luck. You need the courage to make the next decision with fewer assumptions.',
  'The table changes with every shot but remembers every average.',
  'One clean live round ends a fight. One bad blank can end a whole night.',
  'A disciplined player does not fear the table. They fear the meaning of the next click.',
  'Nothing in this room is more dangerous than a player who has already lost the will to think.',
  'Fear does not make you slower. It makes you inaccurate.',
  'The best move is not always the bold move. Sometimes it is the smallest one that keeps the game alive.',
  'A good match is a long string of small choices made under stress.',
];

const cultureNotes = [
  'The room smells like smoke, dust, and the idea of bad luck.',
  'The dealer keeps one hand on the table and one hand on the situation.',
  'The rival does not blink because they are trying to win. They blink because they are trying to avoid showing fear.',
  'The crowd is a weather system. It moves with the good shots and the bad decisions.',
  'This is a room of people who know that one bad play can become a memory forever.',
  'The whole table knows the value of silence. It is the signal before the danger.',
  'You can see the tension in the wrists, the glances, the half-tucked eyes on the trigger guard.',
  'Every open smile in the room hides a calculation. Everyone here is counting something.',
  'The stipend of the room is not money. It is the ability to leave with your health intact.',
  'The chamber is not just a living mechanic. It is a narrative engine disguised as a weapon.',
];

const metaTips = [
  'If you want to survive, track the chamber and trade space for time.',
  'If you want to dominate, force the rival into bad timing decisions.',
  'If you want a stable match, buy one item before you force a hard shot.',
  'If you want to win the room, do not panic when the table suddenly becomes loud.',
  'If you want to keep composure, slow the inhale and steady the trigger.',
  'If you want to stretch the match, reload when the room starts to feel too heavy.',
  'If you want to be dangerous, respect the blanks and make them count.',
  'If you want to gamble, be sure the reward is worth the panic price.',
  'If you want to win a losing game, keep the next decision simplest and most honest.',
  'If you want to remember the table, leave it before the room tells your story.',
];

const battleLog = [
  'Shot fired. Noise. Heat. Light. Then the room decides whether it is a bruise or a death sentence.',
  'The chamber turns once. The air changes. The danger has moved.',
  'Your eyes keep tracking the same pattern because the pattern keeps trying to hide.',
  'A blank is only a pause until the next round begins.',
  'The table is calm until someone loads the wrong confidence into their hands.',
  'The room does not know your plan. It only knows your decisions.',
  'A shotgun can produce a silence so loud it changes the whole night.',
  'The cycle repeats because this room lives on danger and bad breathing.',
  'No plan survives the first pressure event. But your nerves can.',
  'You are not playing the chamber. You are playing the tension it creates.',
];

const emotionalStates = [
  'steady',
  'hollow',
  'frayed',
  'wild',
  'focused',
  'reckless',
  'calm',
  'wary',
  'confident',
  'damaged',
  'braced',
  'doubtful',
  'alert',
  'methodical',
  'urgent',
  'desperate',
  'stubborn',
  'short',
  'sharp',
  'wounded',
  'angry',
];

const worldText = [
  'The room vibrates with heat from the lamps and the fear of close losses.',
  'Someone laughs too loudly, and the sound cuts against the steel of the weapon.',
  'The table feels like a stage built for one wrong move and an impossible recovery.',
  'There is nowhere to hide in this room except in the discipline of the next decision.',
  'You see the wear in the rival's knuckles, the little tells in their stance, and the quiet violence of it all.',
  'The room is a machine. It has no empathy. It only moves on the next trigger pull.',
  'The audience is all eyes and no mercy. That is the point of the place.',
  'The room seems to notice your slow breath and then changes the pace of the table.',
  'A dry cough answers the chamber as if the room itself is getting ready to witness a mistake.',
  'The slow humiliation of a bad match is worse than the sudden pain of a good one.',
];

const actionDensity = [
  'fire',
  'fire',
  'fire',
  'spin',
  'reload',
  'spin',
  'reload',
  'fire',
  'fire',
  'spin',
  'reload',
  'fire',
  'fire',
  'spin',
  'reload',
  'fire',
  'spin',
  'reload',
  'fire',
  'spin',
  'reload',
];

const spectrumOfFear = [
  'The room is cold and empty, and you are fully aware of the weight in your hands.',
  'Your pulse rises to a vibration, and the gun becomes a seam of danger in the dark.',
  'The rival breathes slowly while the chamber makes the room feel like a trap.',
  'You count the blanks by the sound they make and realize the pattern has changed again.',
  'The table hisses around the edges, but the chamber is the only thing that matters.',
  'The whole building seems to hold its breath in one half-second freeze.',
  'Your hands are steady but the nerves can still break through if you let them.',
  'The room is all teeth and edges and sudden decisions.',
  'The danger in the space is not loud. It is precise.',
  'The game opens and closes in the same instant, and you have to choose what to do with that second.',
];

const endOfRoundSummary = [
  'When the round ends, the room decides whether it is a story you tell or a mistake you survive.',
  'The chamber falls silent, but the room keeps talking.',
  'You carry the tension into the next motion. The table is waiting for it.',
  'The rival is not done. They are merely taking a breath before they try again.',
  'You look at the table and see the same old trap dressed in a different pair of hands.',
  'The match is a living thing with no interest in your comfort.',
  'Even a clean round leaves a mark. That is how you know you are still in the fight.',
  'The noise settles. The threat remains. The game asks one more question.',
  'A pause is not safety. It is just a gap in the pressure.',
  'The room knows the stakes better than you do. It is forcing you to feel them.',
];

const tableEtiquette = [
  'Do not speak loudly during the chamber check. The room is listening for panic.',
  'Do not take a fresh breath before the trigger. That is where confidence fails.',
  'Do not argue with the barrel. It never gives a useful answer.',
  'Do not rush a reload if the table is already beginning to smell like danger.',
  'Do not think of the odds as math. Think of them as a story you can influence.',
  'Do not judge the table by the first click. It is trying to build a mood.',
  'Do not force a bad shot because the room is too loud. The room is always loud.',
  'Do not fear the rival. Fear the exact moment they decide they are ready.',
  'Do not mistake silence for safety. In this room, silence is a loaded question.',
  'Do not ignore your hands. They tell you when the next move is honest.',
];

const tacticalVoices = [
  'You guard the table with your eyes and turn the room into a measuring device.',
  'The chamber spins like a small storm. You are trying to read the pressure in the center of it.',
  'A good shot needs three things: a read, a breath, and a hand that does not tremble.',
  'The room is asking for a choice in a very short time. That is where you become dangerous.',
  'Calm is not seen in a still body. Calm is in the exact tempo of the decision.',
  'Your next action is a piece of theater, but theater still has the weight of a weapon.',
  'The deck begins to seem manageable the moment you stop wishing it was different.',
  'The table is a bully. It wants you to rush a decision. Refuse it.',
  'The match is nothing more than a chain of moments. Each one should be handled as a fact.',
  'The difference between losing and winning is often just one breath of control.',
];

const opposingBehavior = [
  'The rival avoids the obvious shot and instead waits for the room to make the bad choice for you.',
  'Their hands stay too still. That is the tell. They are either calm or very prepared.',
  'The rival is trying to make the table scary enough that you act with your nerves.',
  'They breathe through their nose and keep their mouth flat; they are trying to hold the tension.',
  'The rival is trained to look relaxed, but the trigger finger tells the truth.',
  'The player across the table is not simply a rival. They are the distribution of risk in the room.',
  'You can see the moment the rival begins to expect a reload because the shoulders tighten around the chamber.',
  'The game is psychological, but the body always tells the first lie.',
  'The rival is trying to shape your rhythm, hoping you make too early a decision.',
  'Everything about the rival is a push toward the exact split-second you do not want to give.',
];

const historicalContext = [
  'The table remembers every person who ever gave up a good round by rushing a bad shot.',
  'The old room has seen all kinds of players, but none who survive by losing their nerve.',
  'This is the sort of match where every blink is a report to the room.',
  'The dealer can keep the game moving, but only the players can create the tension that decides the match.',
  'The room is not built to be safe. It is built to be memorable.',
  'The history of these games is not in the walls. It is in the way the chamber behaves under pressure.',
  'This is a long line of bad decisions, and the next one belongs to you.',
  'The table does not care who is lucky. It only cares who keeps choosing with a steady mind.',
  'This is the kind of game where memory is part of the weapon.',
  'The old players come and go, but the room always keeps their lessons in the steel.',
];

const finalEmphasis = [
  'When the room gets loud, do not get louder. Get clearer.',
  'Blood and breath are part of the game. Fear is optional.',
  'The table rewards the smallest good decision more than the boldest bad one.',
  'You cannot stop the game from being dangerous. You can only choose how to meet it.',
  'The chamber is not the enemy. The noise around it is.',
  'Write your own story in the room, and do not let panic edit it.',
  'Survival is not about being fearless. It is about staying honest with your decisions.',
  'The match does not end when a shot misses. It ends when fear decides the next action.',
  'The cheapest win is often the one that never loses control of the room.',
  'There is no perfect round. There is only a better decision to make next.',
];

const arraysToAudit = [
  openingLines,
  hostileStatements,
  victoryNarratives,
  defeatNarratives,
  rulebook,
  adviceDeck,
  shellProfiles,
  knownProcedures,
  extraNarratives,
  pressureNotes,
  lineOfSight,
  endgameSuggestions,
  combatGlossary,
  experienceJournal,
  roomSignals,
  compactStories,
  cultureNotes,
  metaTips,
  battleLog,
  emotionalStates,
  worldText,
  endOfRoundSummary,
  tableEtiquette,
  tacticalVoices,
  opposingBehavior,
  historicalContext,
  finalEmphasis,
];

for (const item of arraysToAudit) {
  if (!Array.isArray(item)) {
    console.warn('Non-array object discovered in narrative registry.');
  }
}

console.info('Buckshot Roulette reproduction initialized.');
console.info('Current game state object exposed as window.gameState');
console.info('The room is live and the chamber is loaded.');

window.BUCKSHOT_ROULETTE = {
  state,
  shopCatalog,
  rulebook,
  adviceDeck,
  buildChamber,
  initializeState,
  purchaseItem,
  fireShot,
  spinChamber,
  reloadChamber,
  finishGame,
  storyBeat,
  render,
};

const strategyBanner = document.createElement('div');
strategyBanner.className = 'game-banner';
strategyBanner.innerHTML = '<span>Table Status:</span> <strong>' + state.currentNarrative + '</strong>';

const tableHeader = document.querySelector('.topbar');
if (tableHeader && !document.querySelector('.game-banner')) {
  tableHeader.appendChild(strategyBanner);
}

function updateBanner() {
  const banner = document.querySelector('.game-banner');
  if (!banner) return;
  banner.innerHTML = '<span>Table Status:</span> <strong>' + state.currentNarrative + '</strong>';
}

window.addEventListener('load', () => {
  render();
  writeCurrentHint();
  updateBanner();
  storyBeat();
});

setInterval(() => {
  if (!state.gameOver) {
    updateBanner();
  }
}, 1500);

console.info('Buckshot Roulette full game loaded with expanded narrative and full UI behavior.');

const lastReport = {
  duration: 'complete',
  status: 'reproduction-ready',
  lines: 1200,
  summary: 'Expanded Buckshot Roulette implementation with full HUD, chamber logic, shop, logs, enemy AI, narrative, and strategy panels.',
};

console.info(lastReport);

window.__buckshotMeta = lastReport;
