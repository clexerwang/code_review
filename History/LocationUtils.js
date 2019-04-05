import resolvePathname from 'resolve-pathname';
import valueEqual from 'value-equal';

import { parsePath } from './PathUtils';



export function createLocation(path, state, key, currentLocation) {
  let location;

  //根据传入的path，state，key生成一个结构为：
  /*
  * {
  *   pathname:'',
  *   search:'',
  *   hash:'',
  *   state:'',
  *   key:''
  * }
  * 的location对象。
  */

  if (typeof path === 'string') {

    location = parsePath(path);
    location.state = state;
  } else {

    location = { ...path };

    if (location.pathname === undefined) location.pathname = '';

    if (location.search) {
      if (location.search.charAt(0) !== '?')
        location.search = '?' + location.search;
    } else {
      location.search = '';
    }

    if (location.hash) {
      if (location.hash.charAt(0) !== '#') location.hash = '#' + location.hash;
    } else {
      location.hash = '';
    }

    if (state !== undefined && location.state === undefined)
      location.state = state;
  }

  try {
    location.pathname = decodeURI(location.pathname);
  } catch (e) {
    if (e instanceof URIError) {
      throw new URIError(
        'Pathname "' +
          location.pathname +
          '" could not be decoded. ' +
          'This is likely caused by an invalid percent-encoding.'
      );
    } else {
      throw e;
    }
  }

  if (key) location.key = key;


  //这里是对不完整的路径或相对路径进行处理生成完整的路径
  if (currentLocation) {
    //如果路径为空，仍然保持当前路径
    if (!location.pathname) {
      location.pathname = currentLocation.pathname;
      //如果路径不以'/'开头，说明是相对路径
    } else if (location.pathname.charAt(0) !== '/') {
      //生成完整的路径
      location.pathname = resolvePathname(
        location.pathname,
        currentLocation.pathname
      );
    }
  } else {
    // When there is no prior location and pathname is empty, set it to /
    if (!location.pathname) {
      location.pathname = '/';
    }
  }

  return location;
}

export function locationsAreEqual(a, b) {
  return (
    a.pathname === b.pathname &&
    a.search === b.search &&
    a.hash === b.hash &&
    a.key === b.key &&
    valueEqual(a.state, b.state)
  );
}
