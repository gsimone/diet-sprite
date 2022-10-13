<h1 align="center">
  <img src="https://github.com/gsimone/diet-sprite/blob/main/_images_/logo.svg?raw=true&a=abc" />
</h1>
<p align="center">🧋 A utility toolkit to reduce overdraw when drawing transparent textures & flipbooks in Three.js</p>

<br />
<br />

## Features

- Given a simple transparent image and an alpha threshold, generates a tight mesh around the non-transparent pixels. Depending on how big the texture is being drawn on screen, this will result in notable performance gains.
- For flipbooks or atlases<sup>*</sup> you can generate the geometry for every step and consume it as a vertex attribute - TBD - or a data texture.

## Usage

### 🥤 Single Sprite

The geometry can be easily generated at runtime from an image:

```jsx
// vanilla example
const geometry = new ClippedSpriteGeometry(
  image, // an already loaded HTMLImageElement or a ThreeJS texture
  8, // the number of desired vertices. 4/6/8 seem to give good results most of the time.
  0 // alphaThreshold, 0 means only fully transparent pixels will be discarded
)
```

```jsx
// r3f example
const myTexture = useTexture('myImage.png') // a r3f texture

<instancedMesh>
  <clippedSpriteGeometry args={[
    myTexture,
    8,
    0
  ]} />
  <meshBasicMaterial />
</instancedMesh>
```

#### Note:
- 📐 This version doesn't need a specific material since the geometry includes every necessary attribute.
- 💡 The utility is fast enough that you can use it at runtime for most purposes. Consider generating the geometry offline for intensive usage - eg. big images, large quantities of sprites, etc.

### 💥 Flipbook (WIP)

```js
const [geometry, dataTexture, api] = createFlipbookGeometry(
  image, // an already loaded HTMLImageElement or a ThreeJS texture
  vertices, // the number of desired vertices. 4/6/8 seem to give good results most of the time.
  horizontalSlices, // the number of horizontal slices in the flipbook
  verticalSlices, // the number of vertical slices in the flipbook
  settings // optional settings, see below
)
```

The *flipbook* version is a bit more complex. 

Since we are dealing with a larger number of sprites, we need to generate valid positions for each step in the flipbook. 

The data is then fed to a data texture of size `[number of vertices, number of flipbook steps]` and can be used in the vertex shader using `gl_vertexID` to draw the sprites.

Alternatively, the vertex positions can be generated as an array of vertices and consumed as a vertex attribute.

Note that the generated geometry only holds the correct amount of vertices and the necessary index.

### TODO

- [ ] Contain mode: This would be useful for those cases where you might want to avoid the complexity of fetching the polygon data from the data texture. It would only return the single optimized geometry that can fit ALL the flipbook pages. This means generally lower fill-rate savings but it might be good for imposter sprites, as they are supposed to be a minimal % of fill.


## Test tool

<p align="center">
  <img src="https://github.com/gsimone/diet-sprite/blob/main/_images_/tool.png?raw=true&t=123" />
</p>

You can use the testing tool at [https://gsim.one/diet-sprite/](https://gsim.one/diet-sprite/) to test your configuration. 

## Why

Drawing billboards, clouds, particles is a ROP bound operation [[1]](#1), for which reducing the number of pixels being drawn is a key goal.
A typical texture has significant areas where alpha is 0, leading to wasteful operations that don't contribute to the final image.
This tool generates a geometry that fits tightly around the non-transparent parts of the image.

The tradeoff is having to render a few more triangles, but the downside would only be relevant for very small particles and is expected to be used with instanced meshes.

This method is based on [Graphics Gems for Games - Findings from Avalanche Studios](https://www.humus.name/Articles/Persson_GraphicsGemsForGames.pdf).
Unreal Engine has a similar tool included from [4.11](https://docs.unrealengine.com/4.27/en-US/WhatsNew/Builds/ReleaseNotes/2016/4_11/)


## How it works

The algorithm goes something like this:
- load the image and get every pixel that
  - is over the given alpha threshold
  - is NOT surrounded by all non-transparent pixels
- generate the convex hull for the found points 
  - some simplification might be introduced here but I found that it sometimes leaves points out too easily
- reduce the number of points in the convex hull while keeping all the original points still inside the new polygon:
  - iterate through the convex hull points 
  - add triangles to the polygon in such a way that the SMALLEST possible triangle is created every iteration, thus removing an edge
  - repeat until we get to the target number of points


## Roadmap

- Add support for different pixel checks  (eg. checking something ELSE than the alpha channel value to discard pixels)
- Add support for packed texture atlases. This would possibly require recalculating the convex hull when it overshoots into close textures, but it could also work out fine with an higher number of target vertices.

### Citations

- <a id="1">[1]</a> [Graphics Gems for Games - Findings from Avalanche Studios](https://www.humus.name/Articles/Persson_GraphicsGemsForGames.pdf)