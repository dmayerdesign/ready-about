# Developing

Install dependencies:
```bash
npm i
```

To start locally for development:

```bash
npm start
```

To build the app for production, run:

```bash
npm run build
```

To run the unit tests once, run:

```
npm test
```

To run the unit tests and watch for file changes during development, run:

```
npm run test.watch
```

# Game Rules

## Glossary

**Beam reach**: the point of sail on which the wind is blowing perpendicular to the boat’s direction, or “over the beam” (if your boat is moving northwest, the wind is originating either from the southwest or northeast).

**Beat**: the point of sail on which the wind is blowing at a 45-degree angle against the boat’s direction (if your boat is moving northwest, the wind is originating either from the north or west).

**Bow**: the front of the boat.

**Broad reach**: the point of sail on which the wind is blowing at a 45-degree angle toward the boat’s direction (if your boat is moving northwest, the wind is originating either from the south or east).

**Leeward**: the direction opposite which the wind is originating ("away from" the wind).

**Marker buoy**: a white buoy that must be rounded as part of the race.

**Point of sail**: describes the direction a boat is traveling relative to the wind direction. Points of sail include beat, beam reach, broad reach, and run.

**Port**: the left-hand side of the boat.

**Risk space**: indicated by a pink marker, landing on a risk space allows you to draw a risk card.

**Run**: the point of sail on which the wind is blowing in the same direction as the motion of the boat (if your boat is moving northwest, the wind is originating from the southeast).

**Speed**: the number of spaces your boat is allowed to move in a single direction on your turn. It consists of your **initial speed** — the speed determined by your point of sail — and **bonus speed** added as the result of encountering risk spaces.

**Starboard**: the right-hand side of the boat.

**Starting line**: the imaginary line formed by the 2 green starting buoys.

**Stern**: the rear of the boat.

**Tacking**: turning the boat so that the wind is now coming across the other side, usually to change from beating in one direction to beating in the other.

**Windward**: the direction in which the wind is originating ("into" the wind).


## Pieces



* 6 sailboats
* 2 green starting buoys
* 4 white marker buoys
* 20 pink risk space markers
* 1 weathervane
* 30 course cards
* 40 risk cards


## At the beginning of the game



* Choose a course by drawing a random course card, and set it up. A course consists of:
    * 2 green starting buoys;
    * 1 or more white marker buoys, numbered according to the order in which they must be rounded;
    * 20 pink risk space markers.
* Choose one of the 4 possible wind origin directions randomly, by spinning the weathervane. The options for wind origin direction are NW, NE, SE, and SW. Once chosen, place the weathervane at the corresponding corner of the board, pointing toward the center.
* Roll a die to determine the turn order.
* In order, have each player place their boat somewhere behind the **starting line**.


## Understanding tacking

While there aren’t many rules to this game, some of the concepts can be tricky if you’re new to sailing. The most difficult of these to understand is **tacking**, so let’s review it.

Tacking means changing which side of the boat — port (left) or starboard (right) — the wind is hitting. In this game, you can tack on purpose by changing your move direction, or you can find yourself tacking due to a change in wind direction.

To tack on purpose, assuming the wind origin direction is the same as it was on your last turn, move in a different direction than you did last turn, such that the wind is hitting the opposite side of your boat. (For example, if the wind origin direction is NW, and on your last turn you moved toward the N, moving W would be considered tacking, whereas moving E would not.) Unintentional tacking is also possible if the wind origin direction changes.

<span style="text-decoration:underline;">Tacking only has one consequence in the rules of this game: if your move entails tacking, your **initial speed** can’t be more than 1.</span>


## Starting moves



* The first 3 moves of the game must happen behind the **starting line**, meaning on the side opposite the #1 marker buoy, as sailors compete for the best start.
    * All the normal rules of the game apply in this phase, the one exception being that your boat cannot touch or cross the starting line.
* On your 4th move, you may move your boat onto or across the starting line.


## Moving

Determine your initial speed:



* Figure out one direction in which you want to go, and which point of sail you will be on in that direction; this will determine your **initial speed**, the number of spaces you’re allowed to move this turn, before risk spaces are resolved. You may never move directly into the wind.
    * **Beating** speed: 1
    * **Beam-reaching** speed: 2
    * **Broad-reaching** speed: 2
    * **Running** speed: 1
* If you want to go on a different **tack** from your last turn, your initial speed is 1, regardless of your point of sail. Your speed may still increase during your turn as the result of a risk space. Your first turn of the game, i.e. going from no tack to your first chosen tack, does not count as tacking, and your speed is unaffected. A change in wind direction that changes your tack (the wind was hitting your port side and now it’s hitting your starboard, or vice versa) does count as a tack even though your boat does not change direction.
* If, before you move, there is a boat 1 or 2 spaces away from you in the exact direction of the wind, you must subtract 1 from your initial speed.

Move:



* A move consists of you moving your boat a number of spaces less than or equal to your speed in any single direction, other than directly into the wind. You must move at least 1 space if you have at least 1 speed. Each space you move costs your boat 1 speed, until your speed is 0 or you choose to end your turn. If you’ve moved at least one space, you may end your turn at any time and leave your remaining speed unused (it does not carry over to your next turn).
* If you are on your first, second, or third turn, your turn must end with your boat behind the starting line.
* If, at any point during your move, there is a boat 1 or 2 spaces away from you in the exact direction of the wind, you must subtract 1 from your remaining speed.
* If you collide with a **risk space**, remove the risk space marker from the game, place your boat on the space, and draw a risk card. Once you resolve the risk card, complete your move (if you have speed remaining, continue in your chosen direction). The available cards are:
    * [10%] The wind blows from the (NW/NE/SE/SW). If different from the current wind origin direction, your speed drops to 0.
    * [20%] Change the wind origin to a direction of your choosing (NW/NE/SE/SW). If different from the current wind origin direction, your speed drops to 0.
    * [30%] You catch a gust! Add 1 to your speed.
    * [10%] You find a spinnaker! On your next running tack, your initial speed is 2 instead of 1 until you tack or the wind changes direction.
    * [10%] Move 1 space directly downwind, and end your turn. (Your rudder breaks! / There’s a freak wave and you capsize!)
    * [20%] The wind dies suddenly. Your turn is over.
* Each **marker buoy** must be rounded in order to win the race. Boats must keep marker buoys on their **starboard** side when rounding them, guiding the course in a clockwise direction.
* Colliding with marker buoys is not allowed.
* Colliding with other boats is not allowed unless you have the **right of way**.
    * If one boat has the wind coming over its **starboard** side, a "starboard **tack**", and the other has the wind coming over its **port** side (a "port tack"), the boat on a starboard tack has right of way. 
    * If both boats are on the same tack, the **leeward** boat — the one at risk of having its wind stolen — has right of way. 
    * If both boats are on the same tack and neither boat is closer to the wind, the collision is not allowed and the turn is over. (If such an illegal collision would have been the first move of your turn, you must choose a different move direction.)
    * If you have right of way, the other boat must spin a weathervane and move to the adjacent space in the indicated direction, and your boat must take that boat’s space. (For the other boat, this isn’t really a move, so its official move direction remains whatever it was in its most recent turn.) If the indicated space would be an illegal move, the player may choose another adjacent space that is NOT directly windward.
    * Once the collision is resolved, the turn ends immediately (your speed drops to zero).


## Winning



* A boat wins the race if, after rounding all the marker buoys in the correct order (indicated by their number on the course card), it touches or crosses the starting line before any other boat, traveling the same direction in which the race started.
* The race does not end until the second to last boat crosses the finish line. Once you have crossed the finish, you continue to move normally in turn order until the race is over. Players can use this time to either sail around quietly, or cause chaos at the starting line or elsewhere.