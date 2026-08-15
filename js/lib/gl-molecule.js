const VERTEX = `
attribute vec3 position;
attribute vec3 normal;
attribute vec3 color;
uniform mat4 model;
uniform mat4 projection;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vEye;
void main() {
  vec4 eye = model * vec4(position, 1.0);
  vNormal = mat3(model) * normal;
  vColor = color;
  vEye = eye.xyz;
  gl_Position = projection * eye;
}
`;

const FRAGMENT = `
precision mediump float;
varying vec3 vNormal;
varying vec3 vColor;
varying vec3 vEye;
uniform float ambient;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 view = normalize(-vEye);
  vec3 light = normalize(vec3(-0.35, 0.55, 0.9));
  float diffuse = max(dot(normal, light), 0.0);
  vec3 halfway = normalize(light + view);
  float specular = pow(max(dot(normal, halfway), 0.0), 42.0) * 0.36;
  float rim = pow(1.0 - max(dot(normal, view), 0.0), 3.0) * 0.16;
  vec3 shade = vColor * (ambient + diffuse * 0.82) + specular + rim;
  gl_FragColor = vec4(shade, 1.0);
}
`;

const identity = () => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

const multiply = (a, b) => {
  const out = new Array(16).fill(0);
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 4; column += 1) {
      for (let index = 0; index < 4; index += 1) {
        out[column * 4 + row] += a[index * 4 + row] * b[column * 4 + index];
      }
    }
  }
  return out;
};

const rotationY = (angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, 0, 0, 0, 1];
};

const rotationX = (angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [1, 0, 0, 0, 0, cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1];
};

const rotationZ = (angle) => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, 0, 0, -sin, cos, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
};

const translation = (x, y, z) => {
  const out = identity();
  out[12] = x;
  out[13] = y;
  out[14] = z;
  return out;
};

const scaling = (value) => [value, 0, 0, 0, 0, value, 0, 0, 0, 0, value, 0, 0, 0, 0, 1];

const perspective = (fov, aspect, near, far) => {
  const focal = 1 / Math.tan(fov / 2);
  return [
    focal / aspect, 0, 0, 0,
    0, focal, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
};

const sphereMesh = (detail = 2) => {
  const t = (1 + Math.sqrt(5)) / 2;
  let vertices = [
    [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
    [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
    [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
  ].map((point) => {
    const length = Math.hypot(...point);
    return point.map((value) => value / length);
  });

  let faces = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11],
    [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
    [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9],
    [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];

  for (let step = 0; step < detail; step += 1) {
    const cache = new Map();
    const next = [];
    const midpoint = (a, b) => {
      const key = a < b ? `${a}:${b}` : `${b}:${a}`;
      if (cache.has(key)) return cache.get(key);
      const point = [0, 1, 2].map((axis) => (vertices[a][axis] + vertices[b][axis]) / 2);
      const length = Math.hypot(...point);
      vertices.push(point.map((value) => value / length));
      cache.set(key, vertices.length - 1);
      return vertices.length - 1;
    };
    faces.forEach(([a, b, c]) => {
      const ab = midpoint(a, b);
      const bc = midpoint(b, c);
      const ca = midpoint(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    });
    faces = next;
  }

  const points = [];
  faces.forEach((face) => face.forEach((index) => points.push(vertices[index])));
  return points;
};

const tubeMesh = (segments = 14) => {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const a = (index / segments) * Math.PI * 2;
    const b = ((index + 1) / segments) * Math.PI * 2;
    const first = [Math.cos(a), Math.sin(a)];
    const second = [Math.cos(b), Math.sin(b)];
    points.push(
      { position: [first[0], first[1], 0], normal: [first[0], first[1], 0] },
      { position: [second[0], second[1], 0], normal: [second[0], second[1], 0] },
      { position: [second[0], second[1], 1], normal: [second[0], second[1], 0] },
      { position: [first[0], first[1], 0], normal: [first[0], first[1], 0] },
      { position: [second[0], second[1], 1], normal: [second[0], second[1], 0] },
      { position: [first[0], first[1], 1], normal: [first[0], first[1], 0] },
    );
  }
  return points;
};

const SPHERE = sphereMesh(2);
const TUBE = tubeMesh(14);

const basis = (direction) => {
  const length = Math.hypot(...direction) || 1;
  const forward = direction.map((value) => value / length);
  const guide = Math.abs(forward[1]) > 0.92 ? [1, 0, 0] : [0, 1, 0];
  const right = [
    guide[1] * forward[2] - guide[2] * forward[1],
    guide[2] * forward[0] - guide[0] * forward[2],
    guide[0] * forward[1] - guide[1] * forward[0],
  ];
  const rightLength = Math.hypot(...right) || 1;
  const unitRight = right.map((value) => value / rightLength);
  const up = [
    forward[1] * unitRight[2] - forward[2] * unitRight[1],
    forward[2] * unitRight[0] - forward[0] * unitRight[2],
    forward[0] * unitRight[1] - forward[1] * unitRight[0],
  ];
  return { forward, right: unitRight, up, length };
};

export const createGlRenderer = (canvas) => {
  const gl =
    canvas.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false }) ??
    canvas.getContext('experimental-webgl', { antialias: true, alpha: true });
  if (!gl) return null;

  const compile = (type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vertex = compile(gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vertex || !fragment) return null;

  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  const attributes = {
    position: gl.getAttribLocation(program, 'position'),
    normal: gl.getAttribLocation(program, 'normal'),
    color: gl.getAttribLocation(program, 'color'),
  };
  const uniforms = {
    model: gl.getUniformLocation(program, 'model'),
    projection: gl.getUniformLocation(program, 'projection'),
    ambient: gl.getUniformLocation(program, 'ambient'),
  };

  gl.enable(gl.DEPTH_TEST);
  gl.enable(gl.CULL_FACE);
  gl.cullFace(gl.BACK);

  let count = 0;
  let bound = 1;

  const build = (atoms, bonds, options) => {
    const data = [];
    const push = (position, normal, color) => {
      data.push(position[0], position[1], position[2], normal[0], normal[1], normal[2], color[0], color[1], color[2]);
    };

    const sizeOf = (atom) => Math.max(atom.radius * options.atomScale, options.bondRadius * 1.35);

    atoms.forEach((atom) => {
      const radius = sizeOf(atom);
      SPHERE.forEach((point) => {
        push(
          [atom.position[0] + point[0] * radius, atom.position[1] + point[1] * radius, atom.position[2] + point[2] * radius],
          point,
          atom.color,
        );
      });
    });

    if (options.bondRadius > 0) {
      bonds.forEach((bond) => {
        const from = atoms[bond.a].position;
        const to = atoms[bond.b].position;
        const direction = [to[0] - from[0], to[1] - from[1], to[2] - from[2]];
        const frame = basis(direction);
        const offsets = bond.order >= 2 ? [-1, 1] : [0];
        const spread = options.bondRadius * (bond.order >= 2 ? 1.15 : 0);
        const thickness = options.bondRadius * (bond.order >= 2 ? 0.62 : 1);

        offsets.forEach((side) => {
          const shift = frame.right.map((value) => value * side * spread);
          [0, 1].forEach((half) => {
            const color = half === 0 ? atoms[bond.a].color : atoms[bond.b].color;
            const start = half * 0.5;
            TUBE.forEach((point) => {
              const along = (start + point.position[2] * 0.5) * frame.length;
              const radial = [
                frame.right[0] * point.position[0] + frame.up[0] * point.position[1],
                frame.right[1] * point.position[0] + frame.up[1] * point.position[1],
                frame.right[2] * point.position[0] + frame.up[2] * point.position[1],
              ];
              push(
                [
                  from[0] + shift[0] + frame.forward[0] * along + radial[0] * thickness,
                  from[1] + shift[1] + frame.forward[1] * along + radial[1] * thickness,
                  from[2] + shift[2] + frame.forward[2] * along + radial[2] * thickness,
                ],
                [
                  frame.right[0] * point.normal[0] + frame.up[0] * point.normal[1],
                  frame.right[1] * point.normal[0] + frame.up[1] * point.normal[1],
                  frame.right[2] * point.normal[0] + frame.up[2] * point.normal[1],
                ],
                color,
              );
            });
          });
        });
      });
    }

    const array = new Float32Array(data);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
    count = array.length / 9;

    bound = 1;
    atoms.forEach((atom) => {
      bound = Math.max(bound, Math.hypot(...atom.position) + sizeOf(atom));
    });
  };

  const draw = (view) => {
    const width = canvas.width;
    const height = canvas.height;
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    if (!count) return;

    const distance = (bound / Math.max(0.25, view.scale)) * 3.1;
    const model = multiply(
      translation(0, 0, -distance),
      multiply(rotationX(view.pitch), multiply(rotationY(view.yaw), rotationZ(view.roll ?? 0))),
    );
    const projection = perspective(0.62, width / Math.max(1, height), Math.max(0.1, distance - bound * 3), distance + bound * 4);

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(attributes.position);
    gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(attributes.normal);
    gl.vertexAttribPointer(attributes.normal, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(attributes.color);
    gl.vertexAttribPointer(attributes.color, 3, gl.FLOAT, false, stride, 24);

    gl.uniformMatrix4fv(uniforms.model, false, new Float32Array(model));
    gl.uniformMatrix4fv(uniforms.projection, false, new Float32Array(projection));
    gl.uniform1f(uniforms.ambient, view.ambient ?? 0.24);

    gl.drawArrays(gl.TRIANGLES, 0, count);
  };

  return {
    build,
    draw,
    get bound() {
      return bound;
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
};
