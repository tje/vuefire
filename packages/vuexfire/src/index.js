import mutations from './mutations'
import { VUEXFIRE_SET_VALUE, VUEXFIRE_ARRAY_ADD, VUEXFIRE_ARRAY_REMOVE } from './types'

import { bindCollection, bindDocument } from '@posva/vuefire-core'
export const firebaseMutations = {}
const commitOptions = { root: true }

Object.keys(mutations).forEach(type => {
  // the { commit, state, type, ...payload } syntax is not supported by buble...
  firebaseMutations[type] = (_, context) => {
    mutations[type](context.state, context)
  }
})

// Firebase binding
const subscriptions = new WeakMap()

function bind ({ state, commit, key, ref, ops }, options = { maxRefDepth: 2 }) {
  // TODO check ref is valid
  // TODO check defined in state
  let sub = subscriptions.get(commit)
  if (!sub) {
    sub = Object.create(null)
    subscriptions.set(commit, sub)
  }

  // unbind if ref is already bound
  if (key in sub) {
    unbind({ commit, key })
  }

  return new Promise((resolve, reject) => {
    sub[key] = ref.where
      ? bindCollection(
        {
          vm: state,
          key,
          collection: ref,
          ops,
          resolve,
          reject
        },
        options
      )
      : bindDocument(
        {
          vm: state,
          key,
          document: ref,
          ops,
          resolve,
          reject
        },
        options
      )
  })
}

function unbind ({ commit, key }) {
  const sub = subscriptions.get(commit)
  if (!sub) return
  // TODO dev check before
  sub[key]()
  delete sub[key]
}

export function firebaseAction (action) {
  return function firebaseEnhancedActionFn (context, payload) {
    // get the local state and commit. These may be bound to a module
    const { state, commit } = context
    const ops = {
      set: (target, path, data) => {
        commit(
          VUEXFIRE_SET_VALUE,
          {
            path,
            target,
            data
          },
          commitOptions
        )
        return data
      },
      add: (target, newIndex, data) =>
        commit(VUEXFIRE_ARRAY_ADD, { target, newIndex, data }, commitOptions),
      remove: (target, oldIndex) => {
        const data = target[oldIndex]
        commit(VUEXFIRE_ARRAY_REMOVE, { target, oldIndex }, commitOptions)
        return [data]
      }
    }

    context.bindFirebaseRef = (key, ref, options = {}) =>
      bind({ state, commit, key, ref, ops }, options)
    context.unbindFirebaseRef = key => unbind({ commit, key })
    return action(context, payload)
  }
}
