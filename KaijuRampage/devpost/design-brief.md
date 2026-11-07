---
status: approved
---

# Design brief: KAIJU RAMPAGE: Alien Invasion

<!-- Written by plan-lens from the learner's interview (conducted in Indonesian, translated into English). Values the learner did not choose are marked (default). -->
<!-- Timeline note: a first playable prototype existed before this interview. This brief captures the learner's design decisions and guides the next iteration. -->

## The one spatial moment
I'm bored: in my bedroom, on the living-room couch, or waiting for my food at a café. A miniature city appears below me, and alien UFOs close in on it from the front and the sides. I smash them out of the sky with giant Kaiju claws. The boredom is gone, I'm moving my body, and I feel awesome.

## Why it belongs on glasses
- Uses: **it leaves your body free** (you play by moving your real arms) and **it draws in the world** (the city and the UFOs live in your own room).
- Why it beats the phone or laptop version: on a phone you sit still and tap a screen. Here the game gets you moving ("play while you exercise"), and it works anywhere, with nothing in your hands.
- The twist: Kaiju usually destroy cities. In this game **the Kaiju protects the city**. That reversal is what makes the idea fresh and fun.

## Product or overlay
- Type: product. The game itself is the experience.
- What the real version would sense: the player's hands (Specs hand tracking), so a real punch counts as a real hit.
- Stand-in for the preview: a mouse can't throw a punch, so in the preview the claw's punch is triggered by input: clicking a UFO, pressing Space, or automated input sent through the Lens Studio MCP. The claw then physically swings into the UFO, and the same hit rules apply. As the learner chose, the demo video is driven through the MCP.

## Where things live
- Where the user looks during the main task: slightly downward, at the city and the incoming UFOs.
- City: **below** the player. (default) About 30 cm below eye level and about 50 cm ahead, or on a real table or desk when one is within comfortable reach. About 48 cm across.
- UFOs: arrive **from the front and the sides**, and **never fly too low**. They hover between chest and eye height ((default) 10–25 cm below eye level) and **fire at the city from long range**, so the player can punch them without bending down. About 16 cm wide.
- Kaiju claws: attached to the player's hands on Specs; in the preview, they float at the bottom of the view.
- Score, timer and city health bar: on the player's **right side**, where a quick glance shows the progress. (default) Slightly below eye level, about 60 cm away.
- Main menu (with the high score, coin balance and upgrade shop), countdown and game-over panel: floating above the city, in front of the player. (default) About 70 cm away.

## Hands and input
- Punch a UFO: on Specs, swing a real, fast punch through the UFO (a slow touch doesn't count). In the preview, click the UFO or use automated MCP input; the claw swings and lands the hit.
- Start and Restart: one large button each. Pinch or poke it on Specs, click it in the preview, or simply punch it.
- Upgrades: one large button per upgrade on the main menu. Pinch, poke or click it to spend coins.
- Targets are large and highlight when aimed at.
- Voice: none.

## Progression: coins and upgrades
- Destroying UFOs earns coins: the more UFOs you destroy, the more coins you get. Coins are awarded at the end of every round, **whether the player wins or loses**.
- Coins and upgrade levels are **saved permanently**, so the player can quit the app and continue their progress later.
- Three upgrades, bought with coins on the main menu:
  - **Kaiju attack**: punches deal more damage.
  - **City health**: the city starts each round with more health.
  - **Bonus coin chance**: a higher chance of earning extra coins when destroying a UFO.
- Every upgrade has a cost that **keeps rising with each level** bought. (default) A few levels per upgrade.

## When things show
- Main menu: appears at launch, showing the high score, the coin balance and the upgrade shop; disappears when the game starts.
- Countdown: appears after Start is pressed; then the battle against the aliens begins.
- Score, timer and city health bar: visible on the right during play; hidden on the menu and result screens.
- Damage warning: when the city is hit, a **red** glow appears at the edge of the view **on the side the enemy is attacking from**, like in FPS games (a red glow, not blood).
- Game-over panel: appears when the round ends and shows the score and the coins earned; Restart begins a new round.
- If something needs attention out of view: the red side warning, plus a sound.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. When the Lens starts, a main menu appears with the high score and the coin balance on it.
2. Clicking Start shows a countdown, after which the battle against the aliens begins (UFOs fly in from the front and the sides).
3. Punching a UFO destroys it and the score goes up; the game gets harder as time goes on.
4. During play, the game progress (score and time) and the city health bar are visible on the right side.
5. When the city takes damage, a red warning appears on the side the attacking UFO is on.
6. When the round ends, a game-over panel shows the score and the coins earned, and Restart starts a new round.
7. Back on the main menu, spending coins on an upgrade (Kaiju attack, city health or bonus coin chance) raises its level, lowers the coin balance, and the effect is noticeable in the next round.

## Out of scope
- Multiplayer and online leaderboards.
- Recognizing real objects or people.
- More than one enemy type.

## Risks and open questions
- **Punching (hand speed) can't be tried with a mouse in the preview.** The learner kept punching as the core action. The preview stand-in (clicks, keys or MCP-driven input that make the claw swing) carries the demo. Feel unproven on real glasses.
- The red damage warning sits at the edge of the view (attached to the head), which design guidelines usually discourage. The learner chose it because it reads instantly, as in FPS games. Keep it subtle and short.
- **Saved progress (coins and upgrades) across sessions can't be shown convincingly in the preview**, because the preview resets saved data when the Lens reloads. The learner kept persistent progress. In the demo, progress is shown within one session (play, earn coins, upgrade, play again). Persistence is "feel unproven" until tested on Specs.
- The upgrade shop adds scope close to the deadline. The core loop (punch, protect, win) should stay polished first.
- Playing "anywhere", including at a café, requires some free space in front of the player. Feel unproven.
- Real hand-tracking accuracy, comfort over a full round, and table/desk detection can only be judged on real Specs.

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
