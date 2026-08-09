// 이 앱은 저장소 안의 형제 폴더 `shared/`를 직접 import 한다.
// Metro는 기본적으로 프로젝트 폴더 밖을 쳐다보지 않으므로 두 가지를 일러줘야 한다.
//
//   watchFolders   — 파일이 바뀌었을 때 다시 묶을 대상. 없으면 shared/를 고쳐도 화면이 그대로다.
//   nodeModulesPaths — 모듈을 찾을 곳. shared/에는 node_modules가 없으므로(테스트용 vitest뿐)
//                      mobile/node_modules를 먼저 보게 둔다.
//
// shared/는 의존성이 없는 순수 JS다. 여기에 라이브러리를 쓰는 코드가 들어오면
// 앱과 웹이 각각 그 라이브러리를 설치해야 하므로, 그때는 별도 패키지로 올려야 한다.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, '..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [path.resolve(repoRoot, 'shared')];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(repoRoot, 'node_modules'),
];

module.exports = config;
