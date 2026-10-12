import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';

// Ejecuta los módulos reales de lógica móvil con SecureStore aislado del dispositivo.
const secureStore = 'data:text/javascript,' + encodeURIComponent(`
  const valores = new Map();
  export async function getItemAsync(clave) { return valores.get(clave) ?? null; }
  export async function setItemAsync(clave, valor) { valores.set(clave, valor); }
  export async function deleteItemAsync(clave) { valores.delete(clave); }
`);

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'expo-secure-store') return { url: secureStore, shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
      const archivo = new URL(specifier + '.ts', context.parentURL);
      if (existsSync(archivo)) return { url: archivo.href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.startsWith('file:') && url.endsWith('.ts')) {
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
        }).outputText,
      };
    }
    return nextLoad(url, context);
  },
});
