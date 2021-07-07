import chalk from "chalk";
import { stripIndent } from "common-tags";
//@ts-ignore
import keypress from "keypress";
import yargs from "yargs";

keypress(process.stdin);

(async () => {
    const opts = yargs
        .help()
        .option("color", {
            alias: "c",
            description: "enables/disables color",
            type: "boolean",
        })
        .option("fps", {
            alias: "f",
            description: "sets fps",
            type: "number",
        })
        .parseSync();

    const { supportsColor } = chalk;

    const pacman = `\
██████╗  █████╗  ██████╗███╗   ███╗ █████╗ ███╗   ██╗
██╔══██╗██╔══██╗██╔════╝████╗ ████║██╔══██╗████╗  ██║
██████╔╝███████║██║     ██╔████╔██║███████║██╔██╗ ██║
██╔═══╝ ██╔══██║██║     ██║╚██╔╝██║██╔══██║██║╚██╗██║
██║     ██║  ██║╚██████╗██║ ╚═╝ ██║██║  ██║██║ ╚████║
╚═╝     ╚═╝  ╚═╝ ╚═════╝╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═══╝`;

    console.clear();

    console.log(supportsColor ? chalk.yellowBright(pacman) : pacman);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.clear();

    function scale(value: number, [a1, a2]: [number, number], [b1, b2]: [number, number]) {
        return ((value - a1) * (b2 - b1)) / (a2 - a1) + b1;
    }

    function mostSimilarVector([tx, ty]: [number, number], vectors: [number, number][]) {
        const scores = vectors.map(([x, y]) => Math.abs(tx - x) + Math.abs(ty - y));

        const min = Math.min(...scores);

        const potential = scores.flatMap((score, i) => (score === min ? [vectors[i]] : []));

        return potential[Math.floor(Math.random() * potential.length)];
    }

    function collide(arena: number[][], target: (number | undefined)[][], offset = { x: 0, y: 0 }) {
        const m = target;
        const o = offset;

        const d = m.reduce((d, r, i) => (r.every((v) => v === 0) ? i : d), m.length);

        if (o.y + d > arena.length || o.y < 0) return true;

        for (let y = 0; y < m.length; ++y) {
            for (let x = 0; x < m[y].length; ++x) {
                if (m[y][x] !== 0 && arena[y + o.y] && arena[y + o.y][x + o.x] !== 0) {
                    return true;
                }
            }
        }

        return false;
    }

    function createMatrix(w: number, h: number) {
        const matrix = [];

        while (h--) {
            matrix.push(new Array(w).fill(0));
        }

        return matrix;
    }

    function merge(a: number[][], b: (number | undefined)[][], offset = { x: 0, y: 0 }) {
        const o = offset;

        b.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    a[y + o.y][x + o.x] = value;
                }
            });
        });

        return a;
    }

    function drawMatrix(matrix: number[][]) {
        const top = "┌" + "─".repeat(matrix[0].length) + "┐";
        const side = supportsColor ? chalk.bold("│") : "│";
        const bottom = "└" + "─".repeat(matrix[0].length) + "┘";

        return [
            supportsColor ? chalk.bold(top) : top,
            ...matrix.map((row) => side + row.map((value) => (value ? colors[value] : " ")).join("") + side),
            supportsColor ? chalk.bold(bottom) : bottom,
        ];
    }

    function printScore() {
        if (supportsColor) console.log(chalk.bold(`score:`), chalk.yellow(player.score));
        else console.log(`score:`, player.score.toString());
    }

    function printLives() {
        if (supportsColor) console.log(chalk.bold(`lives:`), chalk.yellow(player.lives));
        else console.log(`lives:`, player.lives.toString());
    }

    function draw() {
        console.clear();

        printScore();

        printLives();

        const output = [...world.map((row) => [...row])];

        merge(output, [[Player.CODE]], player);

        console.log(drawMatrix(output).join("\n"));
    }

    function win() {
        printScore();

        process.exit();
    }

    let renderCounter = 0;

    function update() {
        renderCounter += 1000 / 60;

        player.move();

        if (renderCounter >= 1000 / fps) {
            draw();

            renderCounter = 0;
        }
    }

    process.stdin.on("keypress", (_, key) => {
        if (!key) return;

        if (key.name === "left") player.dirQueue.push({ dir: [-1, 0], timestamp: Date.now() });
        else if (key.name === "right") player.dirQueue.push({ dir: [1, 0], timestamp: Date.now() });
        else if (key.name === "up") player.dirQueue.push({ dir: [0, -1], timestamp: Date.now() });
        else if (key.name === "down") player.dirQueue.push({ dir: [0, 1], timestamp: Date.now() });
        else if (key.name.toLowerCase() === "c" && key.ctrl) process.exit();
    });

    process.stdin.setRawMode(true);
    process.stdin.resume();

    const width = 28;
    const height = 31;

    const colors =
        supportsColor && !opts.color
            ? [" ", chalk.blueBright("█"), chalk.magentaBright("⎼"), chalk.magentaBright("·"), chalk.magentaBright("o"), chalk.yellowBright("@")]
            : [" ", "█", "⎼", "·", "o", "@"];

    type Point = [number, number];

    class Player {
        public static CODE = 5;

        public lives = 3;
        public score = 0;

        public x = 13;
        public y = 23;

        public dir = [1, 0] as Point;

        public dirQueue = [] as { dir: Point; timestamp: number }[];

        public lastMove = 0;

        public addScore(score: number) {
            this.score += score;
        }

        public move() {
            if (Date.now() - this.lastMove > 1000 / 15) {
                dir: {
                    const { dir, timestamp } = this.dirQueue.shift() ?? {};

                    if (dir && timestamp) {
                        if (Date.now() - timestamp > 1000) break dir;

                        if (
                            collide(world, [[Player.CODE]], {
                                x: this.x + dir[0],
                                y: this.y + dir[1],
                            })
                        ) {
                            this.dirQueue.unshift({ dir, timestamp });
                        } else this.dir = dir;
                    }
                }

                const [x, y] = this.dir;

                this.x += x;
                this.y += y;

                if (this.x < 0) this.x = width - 1;
                if (this.x > width - 1) this.x = 0;

                if (collide(world, [[Player.CODE]], this)) {
                    this.x -= x;
                    this.y -= y;
                }

                this.lastMove = Date.now();
            }
        }
    }

    const player = new Player();

    const world = stripIndent(`\
        ############################
        #............##............#
        #.####.#####.##.#####.####.#
        #.####.#####.##.#####.####.#
        #.####.#####.##.#####.####.#
        #..........................#
        #.####.##.########.##.####.#
        #.####.##.########.##.####.#
        #......##....##....##......#
        ######.#####.##.#####.######
        ######.#####.##.#####.######
        ######.##..........##.######
        ######.##.###$$###.##.######
        ######.##.#......#.##.######
        ..........#......#..........
        ######.##.#......#.##.######
        ######.##.########.##.######
        ######.##..........##.######
        ######.##.########.##.######
        ######.##.########.##.######
        #............##............#
        #.####.#####.##.#####.####.#
        #.####.#####.##.#####.####.#
        #...##................##...#
        ###.##.##.########.##.##.###
        ###.##.##.########.##.##.###
        #......##....##....##......#
        #.##########.##.##########.#
        #.##########.##.##########.#
        #..........................#
        ############################
    `)
        .split("\n")
        .map((row) => row.split("").map((c) => (c === "#" ? 1 : c === "." ? 0 : c === "$" ? 2 : 0)));

    const fps = opts.fps ?? 60;

    update();

    setInterval(update, 1000 / 60);
})();
