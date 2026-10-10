const MAX_HP = 5;
const CHAMBER_SIZE = 6;

const state = {
  playerHP: MAX_HP,
  enemyHP: MAX_HP,
  money: 7,
  round: 1,
  chamber: [],
  chamberIndex: 0,
  playerTurn: true,
  gameOver: false,
  armor: 0,
  hotLoad: 0,
  inventory: [],
  enemyTimer: null,
  log: []
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
  newGameBtn: document.getElementById('newGameBtn')
};

const shopCatalog = {
  medkit: { cost: 4, name: 'Medkit', apply() {
    if (state.money < 4) return false;
    state.money -= 4;
    state.playerHP = Math.min(MAX_HP, state.playerHP + 1);
    state.inventory.push('Medkit');
    addLog('You patch yourself with a medkit and steady your breathing.', 'safe');
    return true;
  } },
  armor: { cost: 5, name: 'Armor', apply() {
    if (state.money < 5) return false;
    state.money -= 5;
    state.armor = 1;
    state.inventory.push('Armor');
    addLog('You strap on a steel plate. The next hit will hurt less.', 'safe');
    return true;
  } },
  hotload: { cost: 6, name: 'Hot Load', apply() {
    if (state.money < 6) return false;
    state.money -= 6;
    state.hotLoad = 1;
    state.inventory.push('Hot Load');
    addLog('You load a hotter shell into the next shot.', 'safe');
    return true;
  } },
  salve: { cost: 3, name: 'Salve', apply() {
    if (state.money < 3) return false;
    state.money -= 3;
    state.playerHP = Math.min(MAX_HP, state.playerHP + 2);
    state.inventory.push('Salve');
    addLog('A rough salve brings you back to your feet.', 'safe');
    return true;
  } }
};

document.querySelectorAll('.shop-item').forEach((button) => {
  button.addEventListener('click', () => {
    const key = button.dataset.item;
    const item = shopCatalog[key];
    if (!item) return;
    if (item.apply()) render();
  });
});

els.fireBtn.addEventListener('click', () => {
  if (state.playerTurn && !state.gameOver) fireShot('player');
});

els.spinBtn.addEventListener('click', () => {
  if (state.playerTurn && !state.gameOver) {
    spinChamber();
    addLog('You twist the cylinder and keep your nerve.', 'safe');
    endTurn();
  }
});

els.reloadBtn.addEventListener('click', () => {
  if (state.playerTurn && !state.gameOver) {
    reloadChamber();
    addLog('You slam in a fresh chamber and reset the odds.', 'safe');
    endTurn();
  }
});

els.quitBtn.addEventListener('click', () => {
  if (state.gameOver) return;
  state.playerHP = 0;
  addLog('You fold. The rival wins the table.', 'bad');
  finishGame('enemy');
});

els.newGameBtn.addEventListener('click', initGame);

function initGame() {
  state.playerHP = MAX_HP;
  state.enemyHP = MAX_HP;
  state.money = 7;
  state.round = 1;
  state.armor = 0;
  state.hotLoad = 0;
  state.inventory = [];
  state.playerTurn = true;
  state.gameOver = false;
  state.log = [];
  state.chamber = buildChamber();
  state.chamberIndex = 0;
  clearTimeout(state.enemyTimer);
  addLog('A new match starts. The steel clicks and the room goes still.', 'safe');
  render();
}

function buildChamber() {
  const chamber = Array(CHAMBER_SIZE).fill('blank');
  const liveCount = 2 + Math.floor(Math.random() * 3); // 2 or 3 or 4

  for (let i = 0; i < liveCount; i += 1) {
    let index = Math.floor(Math.random() * CHAMBER_SIZE);
    while (chamber[index] === 'live') {
      index = Math.floor(Math.random() * CHAMBER_SIZE);
    }
    chamber[index] = 'live';
  }

  return chamber;
}

function render() {
  els.playerHpBar.style.width = `${(state.playerHP / MAX_HP) * 100}%`;
  els.enemyHpBar.style.width = `${(state.enemyHP / MAX_HP) * 100}%`;
  els.playerHpValue.textContent = String(state.playerHP);
  els.enemyHpValue.textContent = String(state.enemyHP);
  els.moneyValue.textContent = String(state.money);
  els.roundValue.textContent = String(state.round);
  els.turnBadge.textContent = state.playerTurn ? 'Player Turn' : 'Rival Turn';
  els.turnBadge.className = `turn-badge ${state.playerTurn ? 'player' : 'enemy'}`;

  els.chamber.innerHTML = '';
  state.chamber.forEach((slot, index) => {
    const el = document.createElement('div');
    el.className = `shell ${slot} ${index === state.chamberIndex ? 'active' : ''}`;
    el.textContent = slot === 'live' ? 'Live' : 'Blank';
    els.chamber.appendChild(el);
  });

  els.chamberText.textContent = `Chamber ${state.chamberIndex + 1}`;

  els.inventoryList.innerHTML = '';
  if (state.inventory.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'No gear';
    els.inventoryList.appendChild(li);
  } else {
    state.inventory.forEach((item) => {
      const li = document.createElement('li');
      li.textContent = item;
      els.inventoryList.appendChild(li);
    });
  }

  els.log.innerHTML = '';
  state.log.slice(-12).forEach((entry) => {
    const row = document.createElement('div');
    row.className = `log-entry ${entry.type}`;
    row.innerHTML = entry.text;
    els.log.appendChild(row);
  });

  const actionDisabled = !state.playerTurn || state.gameOver;
  els.fireBtn.disabled = actionDisabled;
  els.spinBtn.disabled = actionDisabled;
  els.reloadBtn.disabled = actionDisabled;
  els.quitBtn.disabled = state.gameOver;
}

function addLog(text, type = 'safe') {
  state.log.push({ text, type });
}

function rotateChamber(amount = 1) {
  state.chamberIndex = (state.chamberIndex + amount) % CHAMBER_SIZE;
}

function spinChamber() {
  const shift = 1 + Math.floor(Math.random() * 4);
  rotateChamber(shift);
}

function reloadChamber() {
  state.chamber = buildChamber();
  state.chamberIndex = 0;
}

function applyDamage(target, rawDamage) {
  const reduced = Math.max(0, rawDamage - state.armor);
  if (target === 'player') {
    state.playerHP = Math.max(0, state.playerHP - reduced);
    state.armor = 0;
  } else {
    state.enemyHP = Math.max(0, state.enemyHP - reduced);
    state.armor = 0;
  }
  if (state.hotLoad > 0) {
    state.hotLoad = 0;
  }
  return reduced;
}

function fireShot(actor) {
  if (state.gameOver) return;

  const current = state.chamber[state.chamberIndex];
  const isLive = current === 'live';
  const damage = state.hotLoad > 0 ? 2 : 1;

  if (isLive) {
    if (actor === 'player') {
      const inflicted = applyDamage('enemy', damage);
      addLog(`<strong>You</strong> fire. The chamber hits a live round and deals <strong>${inflicted}</strong> damage.`, 'bad');
      if (state.enemyHP <= 0) {
        addLog('The rival drops. You win the room.', 'safe');
        finishGame('player');
        return;
      }
    } else {
      const inflicted = applyDamage('player', damage);
      addLog(`<strong>Rival</strong> fires. A live shell tears through your defenses for <strong>${inflicted}</strong> damage.`, 'bad');
      if (state.playerHP <= 0) {
        addLog('You collapse under the heat. The rival takes the table.', 'bad');
        finishGame('enemy');
        return;
      }
    }
  } else {
    if (actor === 'player') {
      addLog('<strong>You</strong> fire a blank. The barrel coughs smoke and everyone breathes again.', 'safe');
    } else {
      addLog('<strong>Rival</strong> fires a blank. The room shudders, but nobody drops.', 'safe');
    }
  }

  state.chamberIndex = (state.chamberIndex + 1) % CHAMBER_SIZE;

  if (actor === 'player') {
    endTurn();
  }

  render();
}

function endTurn() {
  if (state.gameOver) return;
  state.playerTurn = false;
  render();
  clearTimeout(state.enemyTimer);
  state.enemyTimer = setTimeout(enemyTurn, 700);
}

function enemyTurn() {
  if (state.gameOver) return;

  const choice = Math.random();
  let action = 'fire';

  if (choice < 0.18) action = 'spin';
  else if (choice < 0.32) action = 'reload';

  if (action === 'spin') {
    spinChamber();
    addLog('<strong>Rival</strong> spins the chamber and changes the odds.', 'bad');
  } else if (action === 'reload') {
    reloadChamber();
    addLog('<strong>Rival</strong> slaps in a fresh load.', 'bad');
  } else {
    fireShot('enemy');
    if (state.gameOver) return;
  }

  state.playerTurn = true;
  render();
}

function finishGame(winner) {
  state.gameOver = true;
  state.playerTurn = false;
  clearTimeout(state.enemyTimer);

  if (winner === 'player') {
    state.money += 3;
    addLog('The crowd roars. You take the match and pocket the winnings.', 'safe');
  } else {
    addLog('The rival claims the table, and the room falls silent.', 'bad');
  }

  render();
}

initGame();

