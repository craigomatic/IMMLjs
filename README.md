# IMMLjs
A runtime implementation of the [IMML specification](https://github.com/craigomatic/IMML) in JavaScript, powered by [Babylon.js](https://github.com/BabylonJS/Babylon.js)

## Usage

Include references to Babylon.js and IMML.js in your HTML:

```html
    <script src="https://preview.babylonjs.com/Ammo.js"></script>
    <script src="https://preview.babylonjs.com/babylon.js"></script>
    <script src="https://preview.babylonjs.com/loaders/babylonjs.loaders.min.js"></script>
    <script src="https://code.jquery.com/pep/0.4.3/pep.js"></script>
    <script src="js/imml.js"></script>
```

Call `imml.loadFromUri` to load a scene from an IMML document hosted somewhere:

```
<script type="text/javascript">        
    imml.loadFromUri('imml/scene.imml');
</script>
```

## Sample

The include sample uses asp.net core to host a simple website which is capable of loading IMML documents.
