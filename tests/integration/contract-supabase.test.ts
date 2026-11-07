import { createSupabaseCatalog } from "@/lib/data/supabase/catalog";
import { createSupabasePublicClient } from "@/lib/supabase/public";

import { describeCatalogContract } from "../contract/catalog.contract";
import { supabaseIds } from "../contract/fixture-ids";
import { addFillerProducts, resetDb } from "./support";

describeCatalogContract(
  {
    name: "supabase",
    make: () => createSupabaseCatalog({ getClient: createSupabasePublicClient }),
    reset: resetDb,
    addFiller: addFillerProducts,
  },
  supabaseIds,
);
