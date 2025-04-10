// --- Global State ---
let functionalDependencies = []; // Array of {lhs: Set<string>, rhs: Set<string>}
let allAttributes = new Set(); // Set of all unique attribute strings

// --- Helper Functions ---

/**
 * Checks if setA is a superset of setB (A contains all elements of B).
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {boolean}
 */
function isSuperset(setA, setB) {
  if (setB.size === 0) return true; // Empty set is subset of everything
  if (setA.size < setB.size) return false;
  for (const elem of setB) {
    if (!setA.has(elem)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks if setA is a proper superset of setB (A is superset and A != B).
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {boolean}
 */
function isProperSuperset(setA, setB) {
  return setA.size > setB.size && isSuperset(setA, setB);
}

/**
 * Checks if two sets are equal (contain the same elements).
 * @param {Set<string>} setA
 * @param {Set<string>} setB
 * @returns {boolean}
 */
function setsAreEqual(setA, setB) {
  if (setA.size !== setB.size) return false;
  return isSuperset(setA, setB); // If sizes are equal, superset check is sufficient
}

/**
 * Parses a comma-separated string into a Set of trimmed, non-empty attributes.
 * @param {string} str
 * @returns {Set<string>}
 */
function parseAttributes(str) {
  return new Set(
    str
      .split(",")
      .map((attr) => attr.trim())
      .filter((attr) => attr)
  );
}

/**
 * Converts a Set of attributes to a sorted string representation (for keys/comparison).
 * @param {Set<string>} attributeSet
 * @returns {string} Comma-separated sorted string
 */
function setToSortedString(attributeSet) {
  return Array.from(attributeSet).sort().join(", ");
}

/**
 * Combines attributes from LHS and RHS of an FD into a single Set.
 * @param {{lhs: Set<string>, rhs: Set<string>}} fd
 * @returns {Set<string>}
 */
function getFDAttributes(fd) {
  return new Set([...fd.lhs, ...fd.rhs]);
}

// --- UI Interaction Functions ---

function addFD() {
  const lhsInput = document.getElementById("lhs").value.trim();
  const rhsInput = document.getElementById("rhs").value.trim();

  if (!lhsInput || !rhsInput) {
    alert("Please enter both LHS and RHS attributes.");
    return;
  }

  const lhsSet = parseAttributes(lhsInput);
  const rhsSet = parseAttributes(rhsInput);

  if (lhsSet.size === 0 || rhsSet.size === 0) {
    alert("LHS and RHS must contain valid attributes.");
    return;
  }

  // Basic validation: Check if RHS attributes are already in LHS
  const intersection = new Set([...lhsSet].filter((x) => rhsSet.has(x)));
  if (intersection.size === rhsSet.size) {
    alert("Trivial dependency detected (RHS is subset of LHS). Ignoring.");
    clearFDInputs();
    return; // Don't add trivial dependencies
  }
  // Remove attributes from RHS that are already in LHS
  const cleanedRhsSet = new Set([...rhsSet].filter((x) => !lhsSet.has(x)));
  if (cleanedRhsSet.size === 0) {
    alert(
      "Trivial dependency detected (After removing LHS attributes from RHS). Ignoring."
    );
    clearFDInputs();
    return;
  }

  const newFD = {
    lhs: lhsSet,
    rhs: cleanedRhsSet, // Use the cleaned RHS
  };

  // Avoid adding exact duplicate FDs
  const exists = functionalDependencies.some(
    (existingFD) =>
      setsAreEqual(existingFD.lhs, newFD.lhs) &&
      setsAreEqual(existingFD.rhs, newFD.rhs)
  );

  if (!exists) {
    functionalDependencies.push(newFD);
    updateFDList();
  } else {
    alert("This exact functional dependency already exists.");
  }

  clearFDInputs();
}

function updateFDList() {
  const fdList = document.getElementById("fd-list");
  fdList.innerHTML = ""; // Clear existing list

  functionalDependencies.forEach((fd, index) => {
    const fdItem = document.createElement("div");
    fdItem.className = "fd-item";
    fdItem.innerHTML = `
            <span>{${setToSortedString(fd.lhs)}} → {${setToSortedString(
      fd.rhs
    )}}</span>
            <button onclick="removeFD(${index})" title="Remove FD">❌</button>
        `;
    fdList.appendChild(fdItem);
  });

  // Recalculate all attributes whenever FDs change
  updateAllAttributes();
}

function removeFD(index) {
  if (index >= 0 && index < functionalDependencies.length) {
    functionalDependencies.splice(index, 1);
    updateFDList();
  }
}

function clearFDInputs() {
  document.getElementById("lhs").value = "";
  document.getElementById("rhs").value = "";
}

// --- Core Logic Functions ---

/**
 * Updates the global 'allAttributes' set based on the input field and all FDs.
 */
function updateAllAttributes() {
  const attributesInput = document.getElementById("attributes").value;
  allAttributes = parseAttributes(attributesInput);

  // Add attributes from all FDs
  functionalDependencies.forEach((fd) => {
    fd.lhs.forEach((attr) => allAttributes.add(attr));
    fd.rhs.forEach((attr) => allAttributes.add(attr));
  });

  // Update the input field visually to reflect the combined set
  document.getElementById("attributes").value =
    setToSortedString(allAttributes);
}

/**
 * Calculates the closure of a set of attributes under the given FDs.
 * @param {Set<string>} attributesToClose - The initial set of attributes.
 * @param {Array<{lhs: Set<string>, rhs: Set<string>}>} fds - The functional dependencies.
 * @returns {Set<string>} - The calculated closure.
 */
function calculateClosure(attributesToClose, fds) {
  let closure = new Set(attributesToClose);
  let changed = true;

  while (changed) {
    changed = false;
    for (const fd of fds) {
      // Check if LHS is fully contained within the current closure
      if (isSuperset(closure, fd.lhs)) {
        // Add RHS attributes to the closure if they aren't already present
        for (const attr of fd.rhs) {
          if (!closure.has(attr)) {
            closure.add(attr);
            changed = true; // Mark that the closure has changed
          }
        }
      }
    }
  }
  return closure;
}

/**
 * Generates all non-empty subsets of a given set of attributes.
 * @param {Set<string>} attributeSet
 * @returns {Array<Set<string>>}
 */
function generateSubsets(attributeSet) {
  const attributes = Array.from(attributeSet);
  const subsets = [];
  const n = attributes.length;

  // Iterate from 1 (skip empty set) up to 2^n - 1
  for (let i = 1; i < 1 << n; i++) {
    const subset = new Set();
    for (let j = 0; j < n; j++) {
      // Check if the j-th bit is set in i
      if ((i >> j) & 1) {
        subset.add(attributes[j]);
      }
    }
    subsets.push(subset);
  }
  return subsets;
}

/**
 * Calculates the closure for all non-empty subsets of allAttributes.
 * @returns {Map<string, Set<string>>} Map where key is sorted subset string, value is closure Set.
 */
function calculateAllSubsetClosures() {
  const closures = new Map();
  const subsets = generateSubsets(allAttributes);

  for (const subset of subsets) {
    const closure = calculateClosure(subset, functionalDependencies);
    closures.set(setToSortedString(subset), closure);
  }
  return closures;
}

/**
 * Finds all candidate keys for the relation.
 * A candidate key is a minimal superkey.
 * @returns {Array<Set<string>>} - An array of candidate keys (each key is a Set).
 */
function findCandidateKeys() {
  if (allAttributes.size === 0) return [];

  const candidateKeys = [];
  const subsets = generateSubsets(allAttributes); // Generate all non-empty subsets

  let minSuperkeySize = Infinity; // Track the size of the smallest superkey found

  // Pass 1: Find all superkeys and the minimum size
  const superkeys = [];
  for (const subset of subsets) {
    const closure = calculateClosure(subset, functionalDependencies);
    // Check if the closure contains all attributes (is a superkey)
    if (setsAreEqual(closure, allAttributes)) {
      superkeys.push(subset);
      if (subset.size < minSuperkeySize) {
        minSuperkeySize = subset.size;
      }
    }
  }

  // Pass 2: Filter superkeys to find minimal ones (candidate keys)
  // A superkey is minimal if no proper subset of it is also a superkey.
  for (const sk of superkeys) {
    // Only consider superkeys of the minimum size initially found.
    // This is an optimization, as any smaller superkey would have reset minSuperkeySize.
    if (sk.size === minSuperkeySize) {
      // Now, double-check minimality (although size check helps, it's not foolproof if multiple keys of different sizes exist initially)
      let isMinimal = true;
      for (const otherSk of superkeys) {
        if (sk !== otherSk && isProperSuperset(sk, otherSk)) {
          isMinimal = false;
          break;
        }
      }
      // Even more robust check: check proper subsets directly
      // This is slower but guarantees minimality against *any* subset, not just other found superkeys
      /* if (isMinimal) { // Only check if potentially minimal
                 const properSubsets = generateSubsets(sk);
                 for (const pSubset of properSubsets) {
                      if (pSubset.size > 0 && pSubset.size < sk.size) { // Ensure it's a *proper* non-empty subset
                          const pClosure = calculateClosure(pSubset, functionalDependencies);
                          if (setsAreEqual(pClosure, allAttributes)) {
                              isMinimal = false;
                              break;
                          }
                      }
                 }
             } */

      if (isMinimal) {
        // Avoid adding duplicate keys if subsets generated them in different orders
        const keyString = setToSortedString(sk);
        if (!candidateKeys.some((ck) => setToSortedString(ck) === keyString)) {
          candidateKeys.push(sk);
        }
      }
    }
  }

  // Sort candidate keys for consistent output (e.g., by size then lexicographically)
  candidateKeys.sort((a, b) => {
    if (a.size !== b.size) {
      return a.size - b.size;
    }
    return setToSortedString(a).localeCompare(setToSortedString(b));
  });

  // If no candidate keys found via subsets (e.g., empty FDs), the key is all attributes
  if (candidateKeys.length === 0 && allAttributes.size > 0) {
    const closureOfAll = calculateClosure(
      allAttributes,
      functionalDependencies
    );
    if (setsAreEqual(closureOfAll, allAttributes)) {
      // Check if all attributes together form a key
      candidateKeys.push(new Set(allAttributes));
    } else {
      // This case should ideally not happen if attributes exist - implies inconsistent state?
      console.error(
        "Could not determine a candidate key. Attributes might not be closable under given FDs."
      );
    }
  }

  return candidateKeys;
}

/**
 * Checks the highest normal form (BCNF, 3NF, 2NF) the relation satisfies.
 * @param {Array<Set<string>>} candidateKeys - Pre-calculated candidate keys.
 * @returns {object} - { is2NF: boolean, is3NF: boolean, isBCNF: boolean, violations: { '2NF': string[], '3NF': string[], 'BCNF': string[] } }
 */
function checkNormalForms(candidateKeys) {
  const results = {
    isBCNF: true,
    is3NF: true,
    is2NF: true,
    violations: { BCNF: [], "3NF": [], "2NF": [] },
  };

  if (allAttributes.size === 0 || functionalDependencies.length === 0) {
    // An empty relation or one with no FDs is trivially in BCNF
    return results;
  }

  if (candidateKeys.length === 0) {
    console.warn("Cannot check normal forms without candidate keys.");
    results.isBCNF = results.is3NF = results.is2NF = false; // Cannot confirm
    return results;
  }

  // Determine prime attributes (attributes part of *any* candidate key)
  const primeAttributes = new Set();
  candidateKeys.forEach((key) => {
    key.forEach((attr) => primeAttributes.add(attr));
  });

  for (const fd of functionalDependencies) {
    const lhs = fd.lhs;
    const rhs = fd.rhs;
    const lhsString = setToSortedString(lhs);
    const rhsString = setToSortedString(rhs);
    const fdString = `{${lhsString}} → {${rhsString}}`;

    // Trivial dependencies don't violate NFs
    if (isSuperset(lhs, rhs)) {
      continue;
    }

    // --- BCNF Check ---
    // For every non-trivial FD X -> Y, X must be a superkey.
    const lhsClosure = calculateClosure(lhs, functionalDependencies);
    const isLhsSuperkey = setsAreEqual(lhsClosure, allAttributes);

    if (!isLhsSuperkey) {
      results.isBCNF = false;
      results.violations.BCNF.push(fdString);

      // --- 3NF Check (only if BCNF is violated) ---
      // For every non-trivial FD X -> Y, either:
      // 1. X is a superkey (already failed for BCNF violation) OR
      // 2. Every attribute A in Y is a prime attribute.
      const isRhsSubsetPrime = [...rhs].every((attr) =>
        primeAttributes.has(attr)
      );

      if (!isRhsSubsetPrime) {
        results.is3NF = false;
        results.violations["3NF"].push(fdString);

        // --- 2NF Check (only if 3NF is violated) ---
        // For every non-trivial FD X -> Y, if X is a *proper subset* of *any* candidate key,
        // then no attribute A in Y can be a non-prime attribute.
        // (Violation: Partial dependency of a non-prime attribute on a key)
        let isPartialDependencyViolation = false;
        for (const key of candidateKeys) {
          // Check if LHS is a proper subset of this candidate key
          if (isProperSuperset(key, lhs)) {
            // key > lhs && key contains lhs
            // Check if RHS contains any non-prime attribute
            const hasNonPrimeRHS = [...rhs].some(
              (attr) => !primeAttributes.has(attr)
            );
            if (hasNonPrimeRHS) {
              isPartialDependencyViolation = true;
              break; // Found a 2NF violation involving this FD
            }
          }
        }

        if (isPartialDependencyViolation) {
          results.is2NF = false;
          // Only add violation once per FD
          if (!results.violations["2NF"].includes(fdString)) {
            results.violations["2NF"].push(fdString);
          }
        }
      }
    }
  }
  return results;
}

/**
 * Calculates a decomposition into 2NF.
 * Strategy:
 * 1. Identify partial dependencies (X->A where X is proper subset of a key, A is non-prime).
 * 2. Create relations for each partial dependency: R(X U A).
 * 3. Create one relation containing a candidate key and all attributes not involved in partial dependencies.
 * NOTE: This is a common interpretation; others exist. This aims for dependency preservation.
 * @param {Array<Set<string>>} candidateKeys - Pre-calculated candidate keys.
 * @returns {Array<Set<string>>} - Array of relation schemas (Sets of attributes).
 */
function calculate2NFDecomposition(candidateKeys) {
  const decomposition = [];
  const decomposedAttributes = new Set(); // Track attributes already placed

  if (candidateKeys.length === 0) return [];

  const primeAttributes = new Set();
  candidateKeys.forEach((key) =>
    key.forEach((attr) => primeAttributes.add(attr))
  );

  // Find and process partial dependencies
  const partialFDs = [];
  for (const fd of functionalDependencies) {
    for (const key of candidateKeys) {
      // Check if LHS is proper subset of key
      if (isProperSuperset(key, fd.lhs)) {
        // Check if RHS contains non-prime attributes
        const nonPrimeRHS = new Set(
          [...fd.rhs].filter((attr) => !primeAttributes.has(attr))
        );
        if (nonPrimeRHS.size > 0) {
          // Found a partial dependency: fd.lhs -> nonPrimeRHS
          const partialSchema = new Set([...fd.lhs, ...nonPrimeRHS]);
          partialFDs.push(partialSchema);
          partialSchema.forEach((attr) => decomposedAttributes.add(attr));
          // We can often break after finding one key it's partial to,
          // but processing all ensures we capture all such relations.
          // Break might be okay if FDs are minimal. Let's capture all for safety.
        }
      }
    }
  }

  // Add schemas for partial dependencies (ensure uniqueness)
  const uniquePartialSchemas = new Map();
  partialFDs.forEach((schema) => {
    uniquePartialSchemas.set(setToSortedString(schema), schema);
  });
  uniquePartialSchemas.forEach((schema) => decomposition.push(schema));

  // Create a relation for (at least) one candidate key and remaining attributes
  // Attributes remaining = (All Attributes) - (Non-Prime attributes involved in partial dependencies)
  // This ensures the key is present and attributes only fully dependent on the key are kept with it.
  const remainingAttributes = new Set(allAttributes);
  partialFDs.forEach((schema) => {
    schema.forEach((attr) => {
      // Only remove non-prime attributes that were part of a partial dependency
      if (!primeAttributes.has(attr)) {
        remainingAttributes.delete(attr);
      }
    });
  });

  // Ensure at least one full key is present in the remaining schema.
  // If remainingAttributes doesn't contain a full key, add one.
  // This usually happens naturally if we didn't aggressively remove primes.
  let keyInRemaining = false;
  if (remainingAttributes.size > 0) {
    for (const key of candidateKeys) {
      if (isSuperset(remainingAttributes, key)) {
        keyInRemaining = true;
        break;
      }
    }
    // Add the remaining attributes as a schema
    decomposition.push(remainingAttributes);

    if (!keyInRemaining) {
      console.warn(
        "2NF: Key loss detected after removing partials. Adding a key schema."
      );
      // Add a schema containing just one candidate key if none is covered
      decomposition.push(new Set(candidateKeys[0]));
    }
  } else if (allAttributes.size > 0) {
    // If removing partial dependencies removed everything, add back a key
    console.warn(
      "2NF: All attributes removed by partials. Adding a key schema."
    );
    decomposition.push(new Set(candidateKeys[0]));
  }

  // Final step: Refine decomposition - remove schemas that are subsets of others
  const finalDecomposition = [];
  const sortedDecomp = decomposition
    .map((s) => ({ set: s, key: setToSortedString(s) }))
    .sort((a, b) => b.set.size - a.set.size); // Sort by size descending

  for (let i = 0; i < sortedDecomp.length; i++) {
    let isSubset = false;
    for (let j = 0; j < i; j++) {
      // Check against larger sets already added
      if (isSuperset(sortedDecomp[j].set, sortedDecomp[i].set)) {
        isSubset = true;
        break;
      }
    }
    if (!isSubset) {
      // Ensure we don't add duplicate schemas (e.g., if remainingAttrs matched a partial)
      if (
        !finalDecomposition.some((existing) =>
          setsAreEqual(existing, sortedDecomp[i].set)
        )
      ) {
        finalDecomposition.push(sortedDecomp[i].set);
      }
    }
  }

  return finalDecomposition;
}

/**
 * Calculates the Minimal Cover (Canonical Cover) of the functional dependencies.
 * @param {Array<{lhs: Set<string>, rhs: Set<string>}>} fds - Input functional dependencies.
 * @returns {Array<{lhs: Set<string>, rhs: Set<string>}>} - Minimal cover FDs.
 */
function calculateMinimalCover(fds) {
  if (fds.length === 0) return [];

  // Work on a copy
  let currentFDs = fds.map((fd) => ({
    lhs: new Set(fd.lhs),
    rhs: new Set(fd.rhs),
  }));

  // Step 1: Decompose RHS to singleton attributes
  let singletonFDs = [];
  currentFDs.forEach((fd) => {
    fd.rhs.forEach((attr) => {
      singletonFDs.push({ lhs: new Set(fd.lhs), rhs: new Set([attr]) });
    });
  });
  currentFDs = singletonFDs;

  // Step 2: Remove redundant attributes from LHS
  let reducedLHSFDs = [];
  for (const fd of currentFDs) {
    let currentLHS = new Set(fd.lhs);
    // Try removing each attribute from LHS one by one
    for (const attrToRemove of fd.lhs) {
      if (currentLHS.size <= 1) break; // Cannot reduce further

      const testLHS = new Set(currentLHS);
      testLHS.delete(attrToRemove);

      // Check if the attribute in RHS can still be derived without attrToRemove
      // Closure must be calculated using ALL current FDs (before this specific reduction)
      const closure = calculateClosure(testLHS, currentFDs);
      if (closure.has([...fd.rhs][0])) {
        // Check if the single RHS attribute is in the closure
        currentLHS = testLHS; // Removal was successful, update LHS for next iteration
      }
    }
    // Add potentially reduced FD, ensuring LHS is not empty
    if (currentLHS.size > 0) {
      reducedLHSFDs.push({ lhs: currentLHS, rhs: new Set(fd.rhs) });
    }
  }
  currentFDs = reducedLHSFDs;

  // Step 3: Remove redundant FDs
  let minimalCover = [];
  for (let i = 0; i < currentFDs.length; i++) {
    const fdToCheck = currentFDs[i];
    // Temporarily remove fdToCheck and see if its RHS can still be derived from its LHS using the *other* FDs
    const otherFDs = currentFDs.filter((_, index) => index !== i);

    const closure = calculateClosure(fdToCheck.lhs, otherFDs);

    // If the RHS attribute is NOT in the closure calculated WITHOUT this FD, then the FD is necessary.
    if (!closure.has([...fdToCheck.rhs][0])) {
      minimalCover.push(fdToCheck);
    }
  }

  // Optional Step 4: Combine FDs with the same LHS (often done for presentation)
  const combinedFDsMap = new Map();
  minimalCover.forEach((fd) => {
    const lhsKey = setToSortedString(fd.lhs);
    if (!combinedFDsMap.has(lhsKey)) {
      combinedFDsMap.set(lhsKey, { lhs: fd.lhs, rhs: new Set() });
    }
    fd.rhs.forEach((attr) => combinedFDsMap.get(lhsKey).rhs.add(attr));
  });

  return Array.from(combinedFDsMap.values());
}

/**
 * Calculates the 3NF decomposition using the Synthesis Algorithm.
 * Ensures Lossless Join and Dependency Preservation.
 * @param {Array<Set<string>>} candidateKeys - Pre-calculated candidate keys.
 * @returns {Array<Set<string>>} - Array of relation schemas (Sets of attributes).
 */
function calculate3NFDecomposition(candidateKeys) {
  // Step 1: Find a Minimal Cover
  const minimalCover = calculateMinimalCover(functionalDependencies);
  if (minimalCover.length === 0 && allAttributes.size > 0) {
    // If no FDs, the whole relation is the only schema
    return [new Set(allAttributes)];
  }

  // Step 2: Create relation schemas for each FD in the minimal cover
  const decompositionSchemas = new Map(); // Use Map for uniqueness: key=sorted_string, value=Set<string>
  for (const fd of minimalCover) {
    const schemaAttributes = getFDAttributes(fd); // Combine LHS U RHS
    const schemaKey = setToSortedString(schemaAttributes);
    if (!decompositionSchemas.has(schemaKey)) {
      decompositionSchemas.set(schemaKey, schemaAttributes);
    }
  }

  // Step 3: Check if any schema contains a candidate key
  let keyIsCovered = false;
  if (candidateKeys.length > 0) {
    for (const schemaAttributes of decompositionSchemas.values()) {
      for (const key of candidateKeys) {
        if (isSuperset(schemaAttributes, key)) {
          keyIsCovered = true;
          break;
        }
      }
      if (keyIsCovered) break;
    }
  } else {
    // Should have been handled by candidate key finding or earlier checks
    console.warn(
      "3NF: No candidate keys provided or found. Decomposition might be incomplete."
    );
    // If attributes exist but no keys, maybe the original relation is the only schema?
    // Or maybe the key finding failed. For now, proceed assuming minimal cover schemas are it.
  }

  // Step 4: Add a candidate key relation IF none was covered
  if (!keyIsCovered && candidateKeys.length > 0) {
    // Select one candidate key (e.g., the first one) and add its schema
    const keyToAdd = candidateKeys[0];
    const schemaKey = setToSortedString(keyToAdd);
    // Add the key schema if it's not already somehow present
    if (!decompositionSchemas.has(schemaKey)) {
      decompositionSchemas.set(schemaKey, keyToAdd);
    }
  }

  // Step 5: Refine decomposition - remove schemas that are subsets of others
  const finalDecompositionSets = [];
  const sortedSchemas = Array.from(decompositionSchemas.values()).sort(
    (a, b) => b.size - a.size
  ); // Sort by size descending

  for (let i = 0; i < sortedSchemas.length; i++) {
    let isSubset = false;
    for (let j = 0; j < finalDecompositionSets.length; j++) {
      // Check against those already added
      if (setsAreEqual(sortedSchemas[i], finalDecompositionSets[j])) {
        // Check exact duplicate
        isSubset = true; // Treat as subset to avoid adding again
        break;
      }
      if (isSuperset(finalDecompositionSets[j], sortedSchemas[i])) {
        // Check if it's a subset of an existing one
        isSubset = true;
        break;
      }
      // Also check if an existing one is a subset of the current one
      if (isProperSuperset(sortedSchemas[i], finalDecompositionSets[j])) {
        // If the current schema makes an already added one redundant, remove the smaller one
        finalDecompositionSets.splice(j, 1);
        j--; // Adjust index after removal
      }
    }
    if (!isSubset) {
      finalDecompositionSets.push(sortedSchemas[i]);
    }
  }

  return finalDecompositionSets;
}

/**
 * Calculates the BCNF decomposition using the Analysis Algorithm.
 * Ensures Lossless Join but may not preserve all dependencies.
 * @returns {Array<Set<string>>} - Array of relation schemas (Sets of attributes).
 */
function calculateBCNFDecomposition() {
  if (allAttributes.size === 0) return [];

  let resultSchemas = new Set(); // Store final schemas as sorted strings to ensure uniqueness
  let relationsToProcess = [new Set(allAttributes)]; // Start with the universal relation

  const processedRelations = new Set(); // Keep track of relations already processed to avoid infinite loops

  while (relationsToProcess.length > 0) {
    const currentRelationSet = relationsToProcess.pop();
    const currentRelationString = setToSortedString(currentRelationSet);

    // Avoid reprocessing the same relation schema (important for cycles)
    if (processedRelations.has(currentRelationString)) {
      continue;
    }
    processedRelations.add(currentRelationString);

    let foundViolation = false;

    // Check all original FDs against the current sub-relation
    for (const fd of functionalDependencies) {
      const lhs = fd.lhs;
      const rhs = fd.rhs;

      // The FD (X->Y) is relevant to R if X and Y are both subsets of R's attributes
      if (
        isSuperset(currentRelationSet, lhs) &&
        isSuperset(currentRelationSet, rhs)
      ) {
        // Trivial check within the context of R
        if (isSuperset(lhs, rhs)) continue; // Trivial FD doesn't cause violation

        // Check BCNF condition: Is LHS a superkey of the *current relation*?
        // Calculate closure of LHS using *only FDs projected onto currentRelationSet*
        // Simplification: Use all FDs, but check closure against currentRelationSet attributes
        const lhsClosure = calculateClosure(lhs, functionalDependencies);

        // Intersect closure with current relation's attributes
        const projectedClosure = new Set(
          [...lhsClosure].filter((attr) => currentRelationSet.has(attr))
        );

        // Is LHS a superkey for currentRelationSet? (Does its projected closure equal currentRelationSet?)
        const isLhsSuperkeyForRelation = setsAreEqual(
          projectedClosure,
          currentRelationSet
        );

        if (!isLhsSuperkeyForRelation) {
          // BCNF Violation found: FD {lhs} -> {rhs} in relation {currentRelationSet}
          foundViolation = true;

          // Decompose currentRelationSet based on the violating FD (X -> Y)
          // R1 = X U Y
          const r1 = new Set([...lhs, ...rhs]);
          // Ensure R1 only contains attributes from the original relation being split
          const validR1 = new Set(
            [...r1].filter((attr) => currentRelationSet.has(attr))
          );

          // R2 = X U (R - (Y - X))  which simplifies to X U (R - Y)
          const rMinusY = new Set(
            [...currentRelationSet].filter((attr) => !rhs.has(attr))
          );
          const r2 = new Set([...lhs, ...rMinusY]);
          const validR2 = new Set(
            [...r2].filter((attr) => currentRelationSet.has(attr))
          ); // Ensure R2 is also valid

          // Add the two new relations to be processed, replacing the current one
          // Check for non-empty results before adding
          if (validR1.size > 0) relationsToProcess.push(validR1);
          if (validR2.size > 0 && !setsAreEqual(validR1, validR2))
            relationsToProcess.push(validR2); // Avoid adding same relation twice if R1=R2

          break; // Stop checking FDs for this relation and process the decomposed parts
        }
      }
    } // End loop through FDs for currentRelationSet

    // If no BCNF violation was found for this relation, it's in BCNF. Add it to the result.
    if (!foundViolation) {
      // Add the sorted string representation to the result set for uniqueness
      if (currentRelationSet.size > 0) {
        resultSchemas.add(setToSortedString(currentRelationSet));
      }
    }
  } // End while loop

  // Convert the set of sorted strings back to sets of attributes
  return Array.from(resultSchemas).map(
    (schemaString) => new Set(schemaString.split(", "))
  );
}

// --- Main Calculation Orchestrator ---

function calculate() {
  try {
    // Add error handling block

    // 1. Update and Validate Global Attributes & FDs
    updateAllAttributes(); // Recalculates allAttributes based on input and FDs

    if (allAttributes.size === 0) {
      alert("Please define the set of attributes for the relation R.");
      return;
    }
    // No need to check FD length here, handled by individual functions

    // Clear previous results
    // document.getElementById("closure-result").innerHTML = "";
    document.getElementById("subset-closures-result").innerHTML = "";
    document.getElementById("candidate-keys-result").innerHTML = "";
    document.getElementById("normal-forms-result").innerHTML = "";

    // 2. Calculate Closure of All Attributes (Example)
    const closureAll = calculateClosure(allAttributes, functionalDependencies);
    displayResults(
      "closure-result",
      `<h4>Closure of All Attributes</h4><p>R+ = {${setToSortedString(
        closureAll
      )}}</p>`
    );

    // 3. Calculate All Subset Closures (Optional - can be slow)
    if (allAttributes.size <= 8) {
      // Limit subset closures calculation for performance
      const allClosures = calculateAllSubsetClosures();
      let closuresHTML = "<h4>Closures of Subsets</h4><ul>";
      // Sort subsets for display
      const sortedSubsets = Array.from(allClosures.keys()).sort(
        (a, b) => a.length - b.length || a.localeCompare(b)
      );
      sortedSubsets.forEach((subsetKey) => {
        const subset = subsetKey || "∅"; // Handle empty string for potential future empty set inclusion
        const closure = allClosures.get(subsetKey);
        closuresHTML += `<li>{${subset}}+ = {${setToSortedString(
          closure
        )}}</li>`;
      });
      closuresHTML += "</ul>";
      displayResults("subset-closures-result", closuresHTML);
    } else {
      displayResults(
        "subset-closures-result",
        "<h4>Closures of Subsets</h4><p>(Skipped for performance, > 8 attributes)</p>"
      );
    }

    // 4. Find Candidate Keys
    const candidateKeys = findCandidateKeys(); // Returns array of Sets
    let keysHTML = "<h4>Candidate Keys</h4>";
    if (candidateKeys.length > 0) {
      keysHTML += "<ul>";
      candidateKeys.forEach((key) => {
        keysHTML += `<li>{${setToSortedString(key)}}</li>`;
      });
      keysHTML += "</ul>";
    } else {
      keysHTML +=
        "<p>No candidate keys found (or calculation failed). Check attributes and FDs.</p>";
    }
    displayResults("candidate-keys-result", keysHTML);

    // 5. Check Normal Forms & Calculate Decompositions
    let nfHTML = "<h4>Normal Forms & Decompositions</h4>";
    if (candidateKeys.length > 0) {
      // Need keys for NF checks and some decompositions
      const normalFormsResult = checkNormalForms(candidateKeys);

      // --- NF Status ---
      // nfHTML += `<p><b>BCNF:</b> ${
      //   normalFormsResult.isBCNF ? "✅ Yes" : "❌ No"
      // }</p>`;
      if (!normalFormsResult.isBCNF) {
        // nfHTML += `<div class="violations">Violations:<br>${normalFormsResult.violations.BCNF.join(
        //   "<br>"
        // )}</div>`;
        const decompBCNF = calculateBCNFDecomposition(); // Array of Sets
        nfHTML += `<p><u>BCNF Decomposition:</u></p><ul>${decompBCNF
          .map((rel) => `<li>R(${setToSortedString(rel)})</li>`)
          .join("")}</ul>`;
      }

      // nfHTML += `<p><b>3NF:</b> ${
      //   normalFormsResult.is3NF
      //     ? "✅ Yes"
      //     : normalFormsResult.isBCNF
      //     ? "(Implied by BCNF)"
      //     : "❌ No"
      // }</p>`;
      if (!normalFormsResult.is3NF && !normalFormsResult.isBCNF) {
        // Only show if not BCNF already
        // nfHTML += `<div class="violations">Violations:<br>${normalFormsResult.violations[
        //   "3NF"
        // ].join("<br>")}</div>`;
      }
      // Always show 3NF decomposition if not BCNF (it's the target)
      if (!normalFormsResult.isBCNF) {
        const decomp3NF = calculate3NFDecomposition(candidateKeys); // Array of Sets
        nfHTML += `<p><u>3NF Decomposition (Synthesis):</u></p><ul>${decomp3NF
          .map((rel) => `<li>R(${setToSortedString(rel)})</li>`)
          .join("")}</ul>`;
      }

      // nfHTML += `<p><b>2NF:</b> ${
      //   normalFormsResult.is2NF
      //     ? "✅ Yes"
      //     : normalFormsResult.is3NF || normalFormsResult.isBCNF
      //     ? "(Implied by 3NF/BCNF)"
      //     : "❌ No"
      // }</p>`;
      if (
        !normalFormsResult.is2NF &&
        !normalFormsResult.is3NF &&
        !normalFormsResult.isBCNF
      ) {
        // Only show if not 3NF/BCNF
        // nfHTML += `<div class="violations">Violations:<br>${normalFormsResult.violations[
        //   "2NF"
        // ].join("<br>")}</div>`;
        const decomp2NF = calculate2NFDecomposition(candidateKeys); // Array of Sets
        nfHTML += `<p><u>2NF Decomposition:</u></p><ul>${decomp2NF
          .map((rel) => `<li>R(${setToSortedString(rel)})</li>`)
          .join("")}</ul>`;
      }
    } else {
      nfHTML +=
        "<p>Cannot determine normal forms or perform standard decompositions without candidate keys.</p>";
      // Minimal cover might still be useful
      const minimalCover = calculateMinimalCover(functionalDependencies);
      nfHTML += `<p><u>Minimal Cover (Basis for 3NF):</u></p><ul>${minimalCover
        .map(
          (fd) =>
            `<li>{${setToSortedString(fd.lhs)}} → {${setToSortedString(
              fd.rhs
            )}}</li>`
        )
        .join("")}</ul>`;
    }
    displayResults("normal-forms-result", nfHTML);
  } catch (error) {
    console.error("Calculation Error:", error);
    alert(
      `An error occurred during calculation: ${error.message}\nCheck console for details.`
    );
    // Optionally display error in the UI
    displayResults(
      "normal-forms-result",
      `<p style="color: red;">Error: ${error.message}</p>`
    );
  }
}

/**
 * Helper to display results in a specific DOM element.
 * @param {string} elementId - The ID of the target element.
 * @param {string} htmlContent - The HTML content to display.
 */
function displayResults(elementId, htmlContent) {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = htmlContent;
  } else {
    console.warn(`Display element with ID '${elementId}' not found.`);
  }
}

// --- Initial Setup ---
document.addEventListener("DOMContentLoaded", () => {
  // Attach event listeners or perform initial setup if needed
  document.getElementById("add-fd-btn").addEventListener("click", addFD);
  document.getElementById("calculate-btn").addEventListener("click", calculate);
  updateFDList(); // Initialize the list display
});
