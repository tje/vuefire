import { createSnapshot, extractRefs } from './utils'

function bindCollection ({
  vm,
  key,
  collection,
  resolve,
  reject
}) {
  // TODO wait to get all data
  const array = vm[key] = []

  const change = {
    added: ({ newIndex, doc }) => {
      array.splice(newIndex, 0, createSnapshot(doc))
    },
    modified: ({ oldIndex, newIndex, doc }) => {
      array.splice(oldIndex, 1)
      array.splice(newIndex, 0, createSnapshot(doc))
    },
    removed: ({ oldIndex }) => {
      array.splice(oldIndex, 1)
    }
  }

  let ready
  return collection.onSnapshot(({ docChanges }) => {
    // console.log('pending', metadata.hasPendingWrites)
    // docs.forEach(d => console.log('doc', d, '\n', 'data', d.data()))
    docChanges.forEach(c => {
      // console.log(c)
      change[c.type](c)
    })
    if (!ready) {
      ready = true
      resolve(array)
    }
  }, reject)
}

function updateDataFromDocumentSnapshot ({ snapshot, obj, key, subs, depth = 0 }) {
  // TODO extract refs
  const [data, refs] = extractRefs(snapshot)
  obj[key] = data
  // TODO check if no ref is missing
  Object.keys(refs).forEach(refKey => {
    // check if already bound to the same ref -> skip
    const sub = subs[refKey]
    const ref = refs[refKey]
    if (sub && sub.path !== ref.path) {
      sub.unbind()
    }
    // maybe wrap the unbind function to call unbind on every child
    subs[refKey] = {
      unbind: subscribeToDocument({
        ref,
        obj: obj[key],
        key: refKey,
        depth: depth + 1
      }),
      path: ref.path
    }
    // unbind currently bound ref
    // bind ref
    // save unbind callback
    // probably save key or something as well
  })
}

function subscribeToDocument ({ ref, obj, key, depth }) {
  // TODO max depth param, default to 1?
  if (depth > 3) throw new Error('more than 5 nested refs')
  const subs = Object.create(null)
  return ref.onSnapshot(doc => {
    if (doc.exists) {
      updateDataFromDocumentSnapshot({ snapshot: createSnapshot(doc), obj, key, subs, depth })
    }
  })
}

function bindDocument ({
  vm,
  key,
  document,
  resolve,
  reject
}) {
  // TODO warning check if key exists?
  // TODO create boundRefs object
  // const boundRefs = Object.create(null)

  let ready
  const subs = Object.create(null)
  return document.onSnapshot(doc => {
    if (doc.exists) {
      updateDataFromDocumentSnapshot({
        snapshot: createSnapshot(doc),
        obj: vm,
        key,
        subs
      })
    }
    // TODO should resolve be called when all refs are bound?
    if (!ready) {
      ready = true
      resolve(vm[key])
    }
    // TODO bind refs
    // const d = doc.data()
    // if (!boundRefs[d.path]) {
    //   console.log('bound ref', d.path)
    //   boundRefs[d.path] = d.onSnapshot((doc) => {
    //     console.log('ref snap', doc)
    //   }, err => console.log('onSnapshot ref ERR', err))
    // }
  }, reject)

  // TODO return a custom unbind function that unbind all refs
}

function bind ({ vm, key, ref }) {
  return new Promise((resolve, reject) => {
    let unbind
    if (ref.where) {
      unbind = bindCollection({
        vm,
        key,
        collection: ref,
        resolve,
        reject
      })
    } else {
      unbind = bindDocument({
        vm,
        key,
        document: ref,
        resolve,
        reject
      })
    }
    vm._firestoreUnbinds[key] = unbind
  })
}

function install (Vue, options) {
  const strategies = Vue.config.optionMergeStrategies
  strategies.firestore = strategies.methods

  Vue.mixin({
    created () {
      const { firestore } = this.$options
      this._firestoreUnbinds = Object.create(null)
      this.$firestoreRefs = Object.create(null)
      if (!firestore) return
      Object.keys(firestore).forEach(key => {
        this.$bind(key, firestore[key])
      })
    },

    beforeDestroy () {
      Object.values(this._firestoreUnbinds).forEach(unbind => {
        unbind()
      })
      this._firestoreUnbinds = null
      this.$firestoreRefs = null
    }
  })

  // TODO test if $bind exist and warns
  Vue.prototype.$bind = function (key, ref) {
    if (this._firestoreUnbinds[key]) {
      this.$unbind(key)
    }
    const promise = bind({
      vm: this,
      key,
      ref
    })
    this.$firestoreRefs[key] = ref
    return promise
  }

  Vue.prototype.$unbind = function (key) {
    this._firestoreUnbinds[key]()
    delete this._firestoreUnbinds[key]
    delete this.$firestoreRefs[key]
  }
}

export default install