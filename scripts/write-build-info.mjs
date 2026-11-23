import {writeFile} from 'node:fs/promises';
import {createBuildInfo} from '../build-info.mjs';

// GIT_SHA é fornecido pelo EasyPanel durante builds de fontes Git/GitHub.
await writeFile(process.argv[2]||'build-info.json',JSON.stringify(createBuildInfo(process.env.GIT_SHA)));
