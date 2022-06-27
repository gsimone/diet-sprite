## ClippedSpriteGeometry



### Usage

```bash
npm i @gsimone/three-bvc
```

#### Single Sprite

The geometry can be easily generated at runtime as a pre-process step or used once to bake the geometry for a given image.

```js
const geometry = new ClippedSpriteGeometry(
  image, // an already loaded HTMLImageElement
  vertices, // the number of desired vertices. 4/6/8 seem to give good results most of the time.
  settings // optional settings, see below
)
```

#### Flipbook

(explain why the flipbook version is different)

```js
const [geometry, dataTexture] = createFlipbookGeometry(
  image, // an already loaded HTMLImageElement
  vertices, // the number of desired vertices. 4/6/8 seem to give good results most of the time.
  horizontalSlices, // the number of horizontal slices
  verticalSlices, // the number of vertical slices
  settings // optional settings, see below
)
```

#### Atlas

- TBD -

#### Settings 

  * `alphaThreshold`: similar to what you would use to render a sprite, it's the alpha value below which a point is not considered as part of the sprite.
