const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const camera = {
    x: 0,
    y: 0,
    width: 0,
    height: 0
};

const car = {
    x: 50,
    y: 0,

    width: 90,
    height: 45,

    speed: 0,

    maxSpeed: 5000,

    acceleration: 120,
    deceleration: 180
};

const keys = {};

window.addEventListener("keydown", (event) => {
    keys[event.key] = true;
});

window.addEventListener("keyup", (event) => {
    keys[event.key] = false;
});

// const worldScrollSpeed = 100;

function setCameraPosition(x, y) {
    camera.x = x;
    camera.y = y;
}

function worldToScreenX(worldX) {
    return worldX - camera.x;
}

function worldToScreenY(worldY) {
    return worldY - camera.y;
}

const world = {
    startX: 0,
    // endX: 5000
};

function updateCamera(deltaTime) {

    camera.x += car.speed * deltaTime;

    if (camera.x < world.startX) {
        camera.x = world.startX;
    }
}

// function updateCamera(deltaTime) {

//     const cameraSpeed = 200;

//     if (keys.ArrowRight) {
//         camera.x += cameraSpeed * deltaTime;
//     }

//     if (keys.ArrowLeft) {
//         camera.x -= cameraSpeed * deltaTime;
//     }

//     const maxCameraX = Math.max(
//         0,
//         world.endX - canvas.width
//     );

//     if (camera.x < world.startX) {
//         camera.x = world.startX;
//     }

//     if (camera.x > maxCameraX) {
//         camera.x = maxCameraX;
//     }
// }

function updateCar(deltaTime) {

    if (keys.ArrowRight) {

        car.speed += car.acceleration * deltaTime;

        if (car.speed > car.maxSpeed) {
            car.speed = car.maxSpeed;
        }

    } else {

        car.speed -= car.deceleration * deltaTime;

        if (car.speed < 0) {
            car.speed = 0;
        }
    }
}

let lastTime = 0;

const CHUNK_WIDTH = 500;

function getCurrentChunkIndex() {
    return Math.floor(camera.x / CHUNK_WIDTH);
}

function getActiveChunkIndices() {
    const currentChunk = getCurrentChunkIndex();

    return [
        currentChunk - 1,
        currentChunk,
        currentChunk + 1,
        currentChunk + 2,
        currentChunk + 3,
        currentChunk + 4
    ].filter(chunkIndex => chunkIndex >= 0);
}

function getChunkX(chunkIndex) {
    return chunkIndex * CHUNK_WIDTH;
}
// Currently active chunks
const chunks = [];
// All chunks that have ever been created
// This keeps chunk data even after the chunk becomes inactive.
const chunkStore = new Map();

let totalChunksGenerated = 0;
let totalChunksDeleted = 0;

function seededRandom(seed) {
    const x = Math.sin(seed * 12.9898) * 43758.5453;

    return x - Math.floor(x);
}

function getTerrainHeight(worldX) {

    const baseY = 500;

    const sampleSize = 300;

    const position = worldX / sampleSize;

    const index = Math.floor(position);

    const t = position - index;

    const height1 =
        (seededRandom(index) - 0.5) * 160;

    const height2 =
        (seededRandom(index + 1) - 0.5) * 160;

    // Smooth interpolation
    const smoothT =
        t * t * (3 - 2 * t);

    return baseY +
        height1 +
        (height2 - height1) * smoothT;
}

function getObjectYOnTerrain(worldX, objectWidth, objectHeight) {
    const centerX = worldX + objectWidth / 2;
    const terrainY = getTerrainHeight(centerX);    
    return terrainY - objectHeight;
}

function generateChunkTerrain(chunkIndex) {

    const terrainObjects = [];

    const segmentWidth = 100;
    const segmentCount = CHUNK_WIDTH / segmentWidth;

    for (let i = 0; i < segmentCount; i++) {

        const worldX =
            chunkIndex * CHUNK_WIDTH +
            i * segmentWidth;

        const groundY =
            getTerrainHeight(worldX);

        const object = {
            type: "ground",

            x: worldX,

            y: groundY,

            width: segmentWidth + 1,

            height: 1000,

            color: "#333"
        };

        terrainObjects.push(object);
    }

    return terrainObjects;
}

function createChunk(chunkIndex) {

    const existingChunk = chunkStore.get(chunkIndex);

    if (existingChunk) {
        return existingChunk;
    }

    const chunk = {
        index: chunkIndex,
        x: getChunkX(chunkIndex),
        width: CHUNK_WIDTH,
        objects: []
    };

    const terrainObjects = generateChunkTerrain(chunkIndex);

    for (const object of terrainObjects) {
        addObjectToChunk(chunk, object);
    }

    chunkStore.set(chunkIndex, chunk);

    totalChunksGenerated++;

    return chunk;
}

function addChunk(chunk) {

    // Don't add the same chunk twice
    if (!chunks.includes(chunk)) {
        chunks.push(chunk);
    }
}

function getChunk(chunkIndex) {

    // Only return currently active chunk
    return chunks.find(
        chunk => chunk.index === chunkIndex
    );
}

function addObjectToChunk(chunk, object) {
    if (!chunk.objects.includes(object)) {
        chunk.objects.push(object);
    }
}

function ensureActiveChunks() {

    const activeChunkIndices =
        getActiveChunkIndices();

    for (const chunkIndex of activeChunkIndices) {

        let chunk = getChunk(chunkIndex);

        if (!chunk) {

            chunk = createChunk(chunkIndex);

            addChunk(chunk);
        }
    }
}

function cleanupInactiveChunks() {

    const activeChunkIndices =
        getActiveChunkIndices();

    for (
        let i = chunks.length - 1;
        i >= 0;
        i--
    ) {

        const chunk = chunks[i];

        if (
            !activeChunkIndices.includes(
                chunk.index
            )
        ) {

            chunks.splice(i, 1);

            chunkStore.delete(chunk.index);

            totalChunksDeleted++;
        }
    }
}

function getVisibleChunkObjects() {

    const activeChunkIndices =
        getActiveChunkIndices();

    const objects = [];

    for (const chunk of chunks) {

        if (
            activeChunkIndices.includes(
                chunk.index
            )
        ) {

            for (const object of chunk.objects) {
                objects.push(object);
            }
        }
    }

    for (const object of worldObjects) {
        objects.push(object);
    }

    return objects;
}

let nextObjectId = 1;

const worldObjects = [];

const worldObjectManager = {

    create(
        x,
        y,
        width = 100,
        height = 100,
        color = "lime"
    ) {

        return {
            id: nextObjectId++,
            x,
            y,
            width,
            height,
            color
        };
    },

    createOnTerrain(
        x,
        width = 100,
        height = 100,
        color = "lime"
    ) {

        const y = getObjectYOnTerrain(
            x,
            width,
            height
        );

        return this.create(
            x,
            y,
            width,
            height,
            color
        );
    },

    add(object) {

        worldObjects.push(object);

        // Object को उसके सही chunk में डालें
        const chunkIndex =
            Math.floor(object.x / CHUNK_WIDTH);

        let chunk = getChunk(chunkIndex);

        if (!chunk) {

            chunk = createChunk(chunkIndex);

            addChunk(chunk);
        }

        addObjectToChunk(
            chunk,
            object
        );
    },

    remove(id) {

        const index =
            worldObjects.findIndex(
                object => object.id === id
            );

        if (index !== -1) {

            const object =
                worldObjects[index];

            worldObjects.splice(index, 1);

            // Object को chunk से भी हटाएँ
            const chunkIndex =
                Math.floor(
                    object.x / CHUNK_WIDTH
                );

            const chunk =
                getChunk(chunkIndex);

            if (chunk) {

                const objectIndex =
                    chunk.objects.indexOf(
                        object
                    );

                if (objectIndex !== -1) {

                    chunk.objects.splice(
                        objectIndex,
                        1
                    );
                }
            }
        }
    }
};

// Initial chunks
// addChunk(createChunk(0));
// addChunk(createChunk(1));
// addChunk(createChunk(2));

// Yellow object
// worldObjectManager.add(
//     worldObjectManager.createOnTerrain(
//         1500,
//         250,
//         80,
//         "yellow"
//     )
// );

// Cyan object
// worldObjectManager.add(
//     worldObjectManager.createOnTerrain(
//         1800,
//         350,
//         120,
//         "cyan"
//     )
// );

// const terrainTestObject =
//     worldObjectManager.createOnTerrain(
//         1000,
//         80,
//         80,
//         "magenta"
//     );

// worldObjectManager.add(
//     terrainTestObject
// );

function resizeCanvas() {

    canvas.width =
        window.innerWidth;

    canvas.height =
        window.innerHeight;

    camera.width =
        canvas.width;

    camera.height =
        canvas.height;
}

resizeCanvas();

window.addEventListener(
    "resize",
    resizeCanvas
);

let lastChunkIndex = null;

function update(deltaTime) {

    // पहले car की speed update होगी
    updateCar(deltaTime);

    // फिर camera car की speed से चलेगा
    updateCamera(deltaTime);

    // फिर आगे के chunks generate होंगे
    ensureActiveChunks();
}

// function update(deltaTime) {

//     updateCamera(deltaTime);

//     ensureActiveChunks();

//     const currentChunkIndex =
//         getCurrentChunkIndex();
// }

function renderBackground() {

    ctx.fillStyle = "#accdda";

    ctx.fillRect(
        0,
        0,
        canvas.width,
        canvas.height
    );
}

const ROAD_HEIGHT = 100;
const ROAD_COLOR = "#555";
const ROAD_LINE_COLOR = "#fff";

function renderRoad() {

    const roadY =
        canvas.height - ROAD_HEIGHT;

    const startWorldX =
        Math.max(0, camera.x - 200);

    const endWorldX =
        camera.x + canvas.width + 200;

    // =========================================
    // ROAD BASE
    // =========================================

    const roadGradient =
        ctx.createLinearGradient(
            0,
            roadY,
            0,
            canvas.height
        );

    roadGradient.addColorStop(
        0,
        "#4b4b48"
    );

    roadGradient.addColorStop(
        0.5,
        "#3f403d"
    );

    roadGradient.addColorStop(
        1,
        "#343532"
    );

    ctx.fillStyle =
        roadGradient;

    ctx.fillRect(
        0,
        roadY,
        canvas.width,
        ROAD_HEIGHT
    );


    // =========================================
    // ROAD EDGES
    // =========================================

    ctx.strokeStyle =
        "#d8d5c8";

    ctx.lineWidth = 4;

    // Top edge
    ctx.beginPath();

    ctx.moveTo(
        0,
        roadY
    );

    ctx.lineTo(
        canvas.width,
        roadY
    );

    ctx.stroke();


    // =========================================
    // CENTER LINE
    // =========================================

    const dashSpacing = 75;

    const firstDash =
        Math.floor(
            startWorldX / dashSpacing
        ) * dashSpacing;

    for (
        let worldX = firstDash;
        worldX < endWorldX;
        worldX += dashSpacing
    ) {

        const dashIndex =
            Math.floor(
                worldX / dashSpacing
            );

        const random =
            seededRandom(
                dashIndex * 731
            );

        // कुछ जगह line पूरी तरह गायब
        if (random < 0.12) {
            continue;
        }

        const dashLength =
            random > 0.80
                ? 60
                : 28 + random * 22;

        const screenX =
            worldToScreenX(worldX);

        ctx.strokeStyle =
            random < 0.35
                ? "rgba(238,238,238,0.55)"
                : "#eeeeee";

        ctx.lineWidth = 4;

        ctx.beginPath();

        ctx.moveTo(
            screenX,
            roadY + ROAD_HEIGHT / 2
        );

        ctx.lineTo(
            screenX + dashLength,
            roadY + ROAD_HEIGHT / 2
        );

        ctx.stroke();
    }


    // =========================================
    // ROAD FEATURES
    // =========================================

    const cellSize = 700;

    const firstCell =
        Math.floor(
            startWorldX / cellSize
        );

    const lastCell =
        Math.floor(
            endWorldX / cellSize
        );


    // Future collision data
    window.currentRoadFeatures = [];


    for (
        let cell = firstCell;
        cell <= lastCell;
        cell++
    ) {

        if (cell < 0) {
            continue;
        }

        const cellSeed =
            cell * 9187;

        const featureChance =
            seededRandom(cellSeed);

        // हर जगह feature नहीं होगा
        if (featureChance < 0.35) {
            continue;
        }

        const positionRandom =
            seededRandom(
                cellSeed + 20
            );

        const featureX =
            cell * cellSize +
            120 +
            positionRandom * 460;

        const typeRandom =
            seededRandom(
                cellSeed + 40
            );


        // =====================================
        // MANHOLE
        // =====================================

        if (typeRandom < 0.15) {

            const screenX =
                worldToScreenX(featureX);

            const centerX =
                screenX + 18;

            const centerY =
                roadY +
                ROAD_HEIGHT * 0.68;

            ctx.fillStyle =
                "#292a27";

            ctx.beginPath();

            ctx.ellipse(
                centerX,
                centerY,
                18,
                11,
                0,
                0,
                Math.PI * 2
            );

            ctx.fill();

            ctx.strokeStyle =
                "#686961";

            ctx.lineWidth = 2;

            ctx.stroke();


            // Manhole inner lines

            ctx.strokeStyle =
                "#41423e";

            ctx.lineWidth = 1;

            for (
                let i = -6;
                i <= 6;
                i += 6
            ) {

                ctx.beginPath();

                ctx.moveTo(
                    centerX - 11,
                    centerY + i
                );

                ctx.lineTo(
                    centerX + 11,
                    centerY + i
                );

                ctx.stroke();
            }


            window.currentRoadFeatures.push({
                type: "manhole",
                x: featureX,
                width: 36
            });
        }

    }

    // =========================================
    // RESET CANVAS STATE
    // =========================================

    ctx.setLineDash([]);

    ctx.lineDashOffset = 0;
}

function renderCar() {

    const roadY =
        canvas.height - ROAD_HEIGHT;

    const carX = car.x;

    const carY =
        // roadY - car.height - 0;
        roadY - 20;

    // Car body
    ctx.fillStyle = "#d62828";

    ctx.fillRect(
        carX,
        carY + 15,
        car.width,
        30
    );

    // Car roof
    ctx.fillStyle = "#b71c1c";

    ctx.beginPath();

    ctx.moveTo(
        carX + 15,
        carY + 15
    );

    ctx.lineTo(
        carX + 30,
        carY
    );

    ctx.lineTo(
        carX + 65,
        carY
    );

    ctx.lineTo(
        carX + 80,
        carY + 15
    );

    ctx.closePath();

    ctx.fill();

    // Windows
    ctx.fillStyle = "#9bd3e5";

    ctx.fillRect(
        carX + 34,
        carY + 5,
        13,
        10
    );

    ctx.fillRect(
        carX + 50,
        carY + 5,
        13,
        10
    );

    // Wheels
    ctx.fillStyle = "#151515";

    ctx.beginPath();

    ctx.arc(
        carX + 20,
        carY + 45,
        10,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        carX + 70,
        carY + 45,
        10,
        0,
        Math.PI * 2
    );

    ctx.fill();

    // Wheel hubs
    ctx.fillStyle = "#aaa";

    ctx.beginPath();

    ctx.arc(
        carX + 20,
        carY + 45,
        4,
        0,
        Math.PI * 2
    );

    ctx.fill();

    ctx.beginPath();

    ctx.arc(
        carX + 70,
        carY + 45,
        4,
        0,
        Math.PI * 2
    );

    ctx.fill();
}

function drawTerrainTexture() {
    const activeChunkIndices = getActiveChunkIndices();

    for (const chunk of chunks) {

        if (!activeChunkIndices.includes(chunk.index)) {
            continue;
        }

        for (const terrain of chunk.objects) {

            if (terrain.type !== "ground") {
                continue;
            }

            const screenX = worldToScreenX(terrain.x);
            const screenY = worldToScreenY(terrain.y);

            // प्रत्येक terrain segment के लिए fixed random seed
            const seed = terrain.x;

            // छोटे irregular texture patches
            for (let i = 0; i < 5; i++) {

                const random1 = seededRandom(seed + i * 17);
                const random2 = seededRandom(seed + i * 31);
                const random3 = seededRandom(seed + i * 47);

                const patchX =
                    screenX +
                    random1 * terrain.width;

                const patchY =
                    screenY +
                    10 +
                    random2 * 100;

                const width =
                    4 + random3 * 14;

                const height =
                    2 + random2 * 8;

                // अलग-अलग natural shades
                if (random1 < 0.33) {
                    // ctx.fillStyle = "#3f4630";
                    ctx.fillStyle = "#2e6836";
                } else if (random1 < 0.66) {
                    // ctx.fillStyle = "#363d2b";
                    ctx.fillStyle = "#363d2b";
                } else {
                    // ctx.fillStyle = "#292f24";
                    ctx.fillStyle = "#292f24";
                }

                ctx.beginPath();

                // Irregular polygon
                ctx.moveTo(
                    patchX,
                    patchY
                );

                ctx.lineTo(
                    patchX + width * 0.8,
                    patchY - height * 0.3
                );

                ctx.lineTo(
                    patchX + width,
                    patchY + height * 0.5
                );

                ctx.lineTo(
                    patchX + width * 0.6,
                    patchY + height
                );

                ctx.lineTo(
                    patchX + width * 0.15,
                    patchY + height * 0.7
                );

                ctx.closePath();

                ctx.fill();
            }
        }
    }
}

function drawTerrainGrass() {
    const activeChunkIndices = getActiveChunkIndices();

    for (const chunk of chunks) {

        if (!activeChunkIndices.includes(chunk.index)) {
            continue;
        }

        for (const terrain of chunk.objects) {

            if (terrain.type !== "ground") {
                continue;
            }

            // हर terrain segment में grass
            for (let i = 0; i < 4; i++) {

                const seed =
                    terrain.x + i * 137;

                const randomX =
                    seededRandom(seed);

                const randomHeight =
                    4 + seededRandom(seed + 50) * 10;

                const randomWidth =
                    1 + seededRandom(seed + 80) * 2;

                const randomLean =
                    (seededRandom(seed + 120) - 0.5) * 5;

                // Exact world X
                const grassWorldX =
                    terrain.x +
                    randomX * terrain.width;

                // Exact terrain height
                const grassWorldY =
                    getTerrainHeight(grassWorldX);

                // World → Screen
                const x =
                    worldToScreenX(grassWorldX);

                const y =
                    worldToScreenY(grassWorldY);

                // Natural green variation
                const shade =
                    seededRandom(seed + 200);

                if (shade < 0.33) {
                    // ctx.strokeStyle = "#4f5938";
                    ctx.strokeStyle = "#2e5d29";
                } else if (shade < 0.66) {
                    // ctx.strokeStyle = "#596542";
                    ctx.strokeStyle = "#2a5b27";
                } else {
                    // ctx.strokeStyle = "#68744a";
                    ctx.strokeStyle = "#26653b";
                }

                ctx.lineWidth = randomWidth;

                ctx.beginPath();

                // Left blade
                ctx.moveTo(x, y);

                ctx.lineTo(
                    x - 2 + randomLean,
                    y - randomHeight
                );

                // Right blade
                ctx.moveTo(x, y);

                ctx.lineTo(
                    x + 2 + randomLean,
                    y - randomHeight * 0.8
                );

                ctx.stroke();
            }
        }
    }
}

function drawTerrainRocks() {
    const activeChunkIndices = getActiveChunkIndices();

    for (const chunk of chunks) {

        if (!activeChunkIndices.includes(chunk.index)) {
            continue;
        }

        for (const terrain of chunk.objects) {

            if (terrain.type !== "ground") {
                continue;
            }

            const seed = terrain.x + 900;
            const chance = seededRandom(seed);

            if (chance > 0.55) {
                continue;
            }

            // 1 main rock + 0-2 small rocks
            const rockCount =
                1 + Math.floor(
                    seededRandom(seed + 10) * 3
                );

            for (let i = 0; i < rockCount; i++) {

                const rockSeed =
                    seed + i * 173;

                const sizeRandom =
                    seededRandom(rockSeed + 20);

                const rockWidth =
                    i === 0
                        ? 6 + sizeRandom * 20
                        : 3 + sizeRandom * 9;

                const rockHeight =
                    i === 0
                        ? 5 + sizeRandom * 16
                        : 3 + sizeRandom * 7;

                // Main rock के आसपास छोटे rocks
                const offset =
                    i === 0
                        ? 0
                        : (seededRandom(rockSeed + 40) - 0.5) * 45;

                const randomX =
                    seededRandom(rockSeed + 50);

                const rockWorldX =
                    terrain.x +
                    randomX * terrain.width +
                    offset;

                const terrainWorldY =
                    getTerrainHeight(rockWorldX);

                const x =
                    worldToScreenX(rockWorldX);

                const y =
                    worldToScreenY(terrainWorldY);

                const underground =
                    rockHeight * 0.35;

                const topY =
                    y - rockHeight + underground;

                // Rock base color
                const shade =
                    seededRandom(rockSeed + 80);

                if (shade < 0.33) {
                    ctx.fillStyle = "#4b4c45";
                } else if (shade < 0.66) {
                    ctx.fillStyle = "#5a5a52";
                } else {
                    ctx.fillStyle = "#41423c";
                }

                // Main rock shape
                ctx.beginPath();

                ctx.moveTo(
                    x - rockWidth * 0.5,
                    y
                );

                ctx.lineTo(
                    x - rockWidth * 0.42,
                    topY + rockHeight * 0.35
                );

                ctx.lineTo(
                    x - rockWidth * 0.20,
                    topY + rockHeight * 0.08
                );

                ctx.lineTo(
                    x + rockWidth * 0.15,
                    topY
                );

                ctx.lineTo(
                    x + rockWidth * 0.42,
                    topY + rockHeight * 0.28
                );

                ctx.lineTo(
                    x + rockWidth * 0.5,
                    y
                );

                ctx.closePath();

                ctx.fill();

                // Light side
                ctx.fillStyle =
                    "rgba(255,255,255,0.10)";

                ctx.beginPath();

                ctx.moveTo(
                    x - rockWidth * 0.42,
                    topY + rockHeight * 0.35
                );

                ctx.lineTo(
                    x - rockWidth * 0.20,
                    topY + rockHeight * 0.08
                );

                ctx.lineTo(
                    x + rockWidth * 0.15,
                    topY
                );

                ctx.lineTo(
                    x - rockWidth * 0.02,
                    topY + rockHeight * 0.45
                );

                ctx.closePath();

                ctx.fill();

                // Dark side
                ctx.fillStyle =
                    "rgba(0,0,0,0.14)";

                ctx.beginPath();

                ctx.moveTo(
                    x + rockWidth * 0.15,
                    topY
                );

                ctx.lineTo(
                    x + rockWidth * 0.42,
                    topY + rockHeight * 0.28
                );

                ctx.lineTo(
                    x + rockWidth * 0.5,
                    y
                );

                ctx.lineTo(
                    x + rockWidth * 0.05,
                    y
                );

                ctx.closePath();

                ctx.fill();
            }
        }
    }
}

function renderTerrain() {

    const activeChunkIndices =
        getActiveChunkIndices();

    const terrainObjects = [];

    for (const chunk of chunks) {

        if (!activeChunkIndices.includes(chunk.index)) {
            continue;
        }

        for (const object of chunk.objects) {

            if (object.type === "ground") {
                terrainObjects.push(object);
            }
        }
    }

    if (terrainObjects.length === 0) {
        return;
    }

    terrainObjects.sort(
        (a, b) => a.x - b.x
    );

    ctx.beginPath();

    const first = terrainObjects[0];

    ctx.moveTo(
        worldToScreenX(first.x),
        worldToScreenY(first.y)
    );

    for (const terrain of terrainObjects) {

        ctx.lineTo(
            worldToScreenX(terrain.x),
            worldToScreenY(terrain.y)
        );
    }

    const last =
        terrainObjects[terrainObjects.length - 1];

    ctx.lineTo(
        worldToScreenX(
            last.x + last.width
        ),
        canvas.height
    );

    ctx.lineTo(
        worldToScreenX(first.x),
        canvas.height
    );

    ctx.closePath();

    // Terrain में vertical natural color variation
    const terrainGradient = ctx.createLinearGradient(
        0,
        0,
        0,
        canvas.height
    );

    terrainGradient.addColorStop(
        0,
        // "#53603b"
        "#6ae280"
    );

    terrainGradient.addColorStop(
        0.35,
        // "#485535"
        "#1d6323"
    );

    terrainGradient.addColorStop(
        0.7,
        // "#3f4932"
        "#1b6223"
    );

    terrainGradient.addColorStop(
        1,
        // "#35382b"
        "#04340a"
    );

    ctx.fillStyle = terrainGradient;

    ctx.fill();

    drawTerrainTexture();

    drawTerrainRocks();

    drawTerrainGrass();
}

function renderWorld() {
    const chunkObjects = getVisibleChunkObjects();
    // console.log("World Objects:", chunkObjects);
    for (const object of chunkObjects) {

        // Terrain को renderTerrain() handle करेगा
        if (object.type === "ground") {
            continue;
        }

        const screenX =
            worldToScreenX(object.x);

        const screenY =
            worldToScreenY(object.y);

        const isVisible =
            screenX + object.width > 0 &&
            screenX < camera.width &&
            screenY + object.height > 0 &&
            screenY < camera.height;

        if (!isVisible) {
            continue;
        }

        ctx.fillStyle =
            object.color || "lime";

        ctx.fillRect(
            screenX,
            screenY,
            object.width,
            object.height
        );
    }
}

function render() {

    renderBackground();

    renderTerrain();

    renderRoad();

    renderWorld();

    renderCar();

    ctx.fillStyle = "white";

    ctx.font = "20px Arial";

    ctx.fillText(
        `Camera X: ${Math.round(camera.x)}`,
        20,
        30
    );
    ctx.fillText(
        `Car Speed: ${Math.round(car.speed)}`,
        20,
        55
    );
    ctx.fillText(
        `Active Chunks: ${chunks.length}`,
        20,
        80
    );
    ctx.fillText(
        `Stored Chunks: ${chunkStore.size}`,
        20,
        105
    );
    ctx.fillText(
        `Generated: ${totalChunksGenerated}`,
        20,
        130
    );
    ctx.fillText(
        `Deleted: ${totalChunksDeleted}`,
        20,
        155
    );
    if (performance.memory) {
        const memoryMB =
            performance.memory.usedJSHeapSize / 1024 / 1024;

        ctx.fillText(
            `JS Heap: ${memoryMB.toFixed(1)} MB`,
            20,
            180
        );
    }
}

function gameLoop(currentTime) {

    if (lastTime === 0) {
        lastTime = currentTime;
    }

    const deltaTime =
        (currentTime - lastTime) / 1000;

    lastTime = currentTime;

    update(deltaTime);

    // ensureActiveChunks();

    cleanupInactiveChunks();

    render();

    requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);

canvas.addEventListener("touchstart", function (event) {
    event.preventDefault();

    keys.ArrowRight = true;
});

canvas.addEventListener("touchend", function (event) {
    event.preventDefault();

    keys.ArrowRight = false;
});

canvas.addEventListener("touchcancel", function (event) {
    event.preventDefault();

    keys.ArrowRight = false;
});

const orientationBtn = document.getElementById("orientationBtn");

orientationBtn.addEventListener("click", async () => {
    try {
        if (document.documentElement.requestFullscreen) {
            await document.documentElement.requestFullscreen();
        }

        if (screen.orientation && screen.orientation.lock) {
            if (screen.orientation.type.startsWith("portrait")) {
                await screen.orientation.lock("landscape");
            } else {
                await screen.orientation.lock("portrait");
            }
        }
    } catch (error) {
        console.log("Orientation change not supported:", error);
    }
});