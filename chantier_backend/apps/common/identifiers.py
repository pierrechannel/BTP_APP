"""Internal identifiers, distinct from external and semantic codes."""

AUTOMATIC_IDENTIFIERS = {
    "projects.project": ("code", "PRJ"),
    "projects.lot": ("code", "LOT"),
    "resources.material": ("reference", "MAT"),
    "resources.purchaseorder": ("order_number", "BC"),
    "resources.stocklocation": ("code", "DEP"),
    "workforce.certification": ("code", "HAB"),
    "qhse.inspectiontemplate": ("code", "INS"),
    "qhse.ppsps": ("reference", "PPSPS"),
    "reports.reporttemplate": ("code", "RAP"),
    "budget.amendment": ("reference", "AVN"),
}
