const suits = ['♠', '♥', '♦', '♣'];
const ranks = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
const suitFromCode = { S: '♠', H: '♥', D: '♦', C: '♣' };
const rankValue = Object.fromEntries(ranks.map((rank, index) => [rank, index + 2]));

let hole = [];
let board = [];
let players = 2;
let timer;
let manualMode = false;

const $ = id => document.getElementById(id);
const key = cardValue => cardValue.r + cardValue.s;
const used = () => new Set([...hole, ...board].map(key));
const deck = () => suits.flatMap(suit => ranks.map((rank, index) => ({ r: rank, s: suit, v: index + 2 })));

function shuffle(cards) {
  const shuffled = [...cards];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return shuffled;
}

function card(cardValue) {
  const isRed = cardValue.s === '♥' || cardValue.s === '♦';
  return `<div class="card ${isRed ? 'red' : ''}"><span>${cardValue.r}${cardValue.s}</span><span>${cardValue.r}${cardValue.s}</span></div>`;
}

function emptyCards(count) {
  return Array.from({ length: Math.max(0, count) }, () => '<div class="empty-card"></div>').join('');
}

function renderCards() {
  $('holeCards').innerHTML = hole.map(card).join('') + emptyCards(2 - hole.length);
  $('boardCards').innerHTML = board.map(card).join('') + emptyCards(5 - board.length);
}

function best5(cards) {
  let top = 0;
  for (let a = 0; a < cards.length - 4; a += 1) {
    for (let b = a + 1; b < cards.length - 3; b += 1) {
      for (let c = b + 1; c < cards.length - 2; c += 1) {
        for (let d = c + 1; d < cards.length - 1; d += 1) {
          for (let e = d + 1; e < cards.length; e += 1) {
            top = Math.max(top, score([cards[a], cards[b], cards[c], cards[d], cards[e]]));
          }
        }
      }
    }
  }
  return top;
}

function score(cards) {
  const values = cards.map(cardValue => cardValue.v).sort((a, b) => b - a);
  const counts = {};
  values.forEach(value => { counts[value] = (counts[value] || 0) + 1; });
  const groups = Object.entries(counts)
    .map(([value, count]) => [+value, count])
    .sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const flush = cards.every(cardValue => cardValue.s === cards[0].s);
  const unique = [...new Set(values)];
  const straightHigh = unique[0] === 14 && unique.includes(2) && unique.includes(3) && unique.includes(4) && unique.includes(5)
    ? 5
    : unique.length === 5 && unique[0] - unique[4] === 4 ? unique[0] : 0;
  const pack = (type, parts) => type * 1e10 + parts.reduce((number, value, index) => number + value * Math.pow(15, 4 - index), 0);

  if (flush && straightHigh) return pack(8, [straightHigh]);
  if (groups[0][1] === 4) return pack(7, [groups[0][0], groups[1][0]]);
  if (groups[0][1] === 3 && groups[1][1] === 2) return pack(6, [groups[0][0], groups[1][0]]);
  if (flush) return pack(5, values);
  if (straightHigh) return pack(4, [straightHigh]);
  if (groups[0][1] === 3) return pack(3, [groups[0][0], ...groups.slice(1).map(group => group[0])]);
  if (groups[0][1] === 2 && groups[1][1] === 2) return pack(2, [groups[0][0], groups[1][0], groups[2][0]]);
  if (groups[0][1] === 2) return pack(1, [groups[0][0], ...groups.slice(1).map(group => group[0])]);
  return pack(0, values);
}

function category(scoreValue) {
  return ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'][Math.floor(scoreValue / 1e10)];
}

function drawStats() {
  const needed = 5 - board.length;
  if (!needed) {
    const made = category(best5([...hole, ...board]));
    $('drawOdds').innerHTML = `<div class="draw"><strong>100%</strong><span>${made} made</span></div>`;
    return;
  }

  const remaining = deck().filter(cardValue => !used().has(key(cardValue)));
  const counts = {};
  let total = 0;
  const addRunout = runout => {
    const made = category(best5([...hole, ...board, ...runout]));
    counts[made] = (counts[made] || 0) + 1;
    total += 1;
  };

  if (needed === 1) {
    remaining.forEach(cardValue => addRunout([cardValue]));
  } else if (needed === 2) {
    for (let first = 0; first < remaining.length; first += 1) {
      for (let second = first + 1; second < remaining.length; second += 1) addRunout([remaining[first], remaining[second]]);
    }
  } else {
    for (let sample = 0; sample < 5000; sample += 1) addRunout(shuffle(remaining).slice(0, needed));
  }

  const order = ['One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];
  $('drawOdds').innerHTML = order.filter(name => counts[name]).map(name => `<div class="draw"><strong>${(counts[name] / total * 100).toFixed(1)}%</strong><span>finish as ${name.toLowerCase()}</span></div>`).join('') || '<div class="draw"><strong>—</strong><span>Deal community cards</span></div>';
}

function simulate() {
  clearTimeout(timer);
  $('winOdds').textContent = '…';
  $('equityNote').textContent = 'Running local simulations…';
  timer = setTimeout(() => {
    const remaining = deck().filter(cardValue => !used().has(key(cardValue)));
    let wins = 0;
    let ties = 0;
    const trials = board.length < 3 ? 5000 : 8000;

    for (let trial = 0; trial < trials; trial += 1) {
      const shuffled = shuffle(remaining);
      let index = 0;
      const fullBoard = [...board];
      while (fullBoard.length < 5) fullBoard.push(shuffled[index++]);

      const mine = best5([...hole, ...fullBoard]);
      let highest = mine;
      let tied = 1;
      for (let opponent = 1; opponent < players; opponent += 1) {
        const opponentScore = best5([shuffled[index++], shuffled[index++], ...fullBoard]);
        if (opponentScore > highest) {
          highest = opponentScore;
          tied = 1;
        } else if (opponentScore === highest) {
          tied += 1;
        }
      }
      if (mine === highest) {
        if (tied === 1) wins += 1;
        else ties += 1 / tied;
      }
    }

    $('winOdds').textContent = `${((wins + ties) / trials * 100).toFixed(1)}%`;
    $('equityNote').textContent = `${trials.toLocaleString()} randomized deals • ties split fairly`;
  }, 30);
}

function advice() {
  const [high, low] = hole.map(cardValue => cardValue.v).sort((a, b) => b - a);
  const suited = hole[0].s === hole[1].s;
  const pair = high === low;
  const connected = high - low === 1;
  const text = pair
    ? 'A pair is a hand to apply pressure with—but respect a crowded field, where overcards and sets are common.'
    : suited && connected
      ? 'This is the kind of disguised, suited connector Brunson loved for big-potential pots. With a strong draw, his style was to apply pressure.'
      : high >= 13 && low >= 10
        ? 'A premium broadway combination: the power-poker instinct is to take initiative, particularly with fewer opponents.'
        : high <= 9 && low <= 6
          ? 'A modest hand needs a clear reason to continue. Doyle prized implied odds, but would not pay heavily just to hope.'
          : 'Treat this as a context hand: table size, position, stack depth, and action matter as much as its two cards.';
  $('doyleAdvice').textContent = text;
}

function parseCardList(value) {
  const cleaned = value.toUpperCase()
    .replace(/10/g, 'T')
    .replace(/♠/g, 'S')
    .replace(/♥/g, 'H')
    .replace(/♦/g, 'D')
    .replace(/♣/g, 'C');
  const tokens = cleaned.match(/[2-9TJQKA][SHDC]/g) || [];
  const remaining = cleaned.replace(/[2-9TJQKA][SHDC]/g, '').replace(/[\s,;/.|_-]/g, '');
  if (remaining) return { error: 'Use cards such as A♠ K♦ or As Kd.' };

  const cards = tokens.map(token => ({ r: token[0], s: suitFromCode[token[1]], v: rankValue[token[0]] }));
  if (new Set(cards.map(key)).size !== cards.length) return { error: 'A card cannot be entered twice.' };
  return { cards };
}

function updateManualCards() {
  const enteredHole = parseCardList($('holeInput').value);
  const enteredBoard = parseCardList($('boardInput').value);
  const feedback = $('cardFeedback');

  if (enteredHole.error || enteredBoard.error) {
    hole = [];
    board = [];
    feedback.textContent = enteredHole.error || enteredBoard.error;
  } else if (enteredHole.cards.length !== 2) {
    hole = [];
    board = [];
    feedback.textContent = 'Enter exactly two cards for your hand.';
  } else if (enteredBoard.cards.length > 5) {
    hole = [];
    board = [];
    feedback.textContent = 'You can enter up to five community cards.';
  } else if (new Set([...enteredHole.cards, ...enteredBoard.cards].map(key)).size !== enteredHole.cards.length + enteredBoard.cards.length) {
    hole = [];
    board = [];
    feedback.textContent = 'A card cannot appear in both your hand and the board.';
  } else {
    hole = enteredHole.cards;
    board = enteredBoard.cards;
    feedback.textContent = board.length ? 'Odds update whenever a new board card is entered.' : 'Pre-flop odds are ready.';
  }
  update();
}

function clearManualCards() {
  $('holeInput').value = '';
  $('boardInput').value = '';
  hole = [];
  board = [];
  $('cardFeedback').textContent = 'Enter your two cards to calculate odds.';
  update();
}

function setMode(useManualCards) {
  manualMode = useManualCards;
  $('manualEntry').hidden = !manualMode;
  $('randomMode').classList.toggle('active', !manualMode);
  $('manualMode').classList.toggle('active', manualMode);
  if (manualMode) clearManualCards();
  else newHand();
}

function update() {
  renderCards();
  $('street').textContent = ['PRE-FLOP', 'FLOP', 'TURN', 'RIVER'][Math.max(0, board.length - 2)] || 'PRE-FLOP';
  $('boardLabel').textContent = manualMode && !board.length ? 'Enter cards below' : board.length ? `${board.length} of 5 dealt` : 'Not dealt';
  $('drawLabel').textContent = board.length === 5 ? 'Final hand' : `${5 - board.length} card${5 - board.length === 1 ? '' : 's'} to come`;
  $('dealNext').hidden = manualMode;
  $('newHand').textContent = manualMode ? 'Clear cards' : 'New hand';
  $('dealNext').textContent = board.length === 0 ? 'Deal flop' : board.length < 5 ? `Deal ${board.length === 3 ? 'turn' : 'river'}` : 'New hand';

  if (hole.length !== 2) {
    clearTimeout(timer);
    $('winOdds').textContent = '—';
    $('equityNote').textContent = manualMode ? 'Enter your two cards to run the simulation.' : 'Choose a table size to run the simulation.';
    $('drawOdds').innerHTML = '<div class="draw"><strong>—</strong><span>Enter your two cards first</span></div>';
    $('doyleAdvice').textContent = 'Enter your two cards to get a Doyle-inspired practice note.';
    return;
  }

  drawStats();
  simulate();
  advice();
}

function newHand() {
  const shuffled = shuffle(deck());
  hole = shuffled.slice(0, 2);
  board = [];
  update();
}

function setup() {
  for (let count = 2; count <= 11; count += 1) {
    const button = document.createElement('button');
    button.textContent = count;
    button.onclick = () => {
      players = count;
      document.querySelectorAll('.player-grid button').forEach(item => item.classList.toggle('active', +item.textContent === count));
      $('playerLabel').textContent = `${count} players`;
      if (hole.length === 2) simulate();
    };
    $('playerGrid').append(button);
  }

  $('newHand').onclick = () => manualMode ? clearManualCards() : newHand();
  $('dealNext').onclick = () => {
    if (board.length === 5) newHand();
    else {
      const shuffled = shuffle(deck().filter(cardValue => !used().has(key(cardValue))));
      board.push(...shuffled.slice(0, board.length ? 1 : 3));
      update();
    }
  };
  $('randomMode').onclick = () => setMode(false);
  $('manualMode').onclick = () => setMode(true);
  $('holeInput').addEventListener('input', updateManualCards);
  $('boardInput').addEventListener('input', updateManualCards);
  $('clearActual').onclick = clearManualCards;

  document.querySelector('.player-grid button').click();
  newHand();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./service-worker.js');
}

setup();