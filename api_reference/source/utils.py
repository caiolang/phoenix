# Define the modules and members to include in Sphinx documentation
INCLUDE_MEMBERS = {
    "inferences.inferences": {"Inferences": ["__init__"]},
}


def clean_doc_output(app, docname, source):
    """
    Process .rst sources generated by autodoc to remove unwanted text outside
    automodule blocks and adjust formatting for Sphinx.
    """

    if source:
        processed, in_automodule = [], False
        for line in source[0].split("\n"):
            # Check for the start of the automodule block
            if ".. automodule::" in line:
                in_automodule = True

            # Check if we are still in the automodule block
            if in_automodule and line.strip() == "":
                processed.append(line)
                continue

            # Check if we are out of the automodule block
            if in_automodule and line.strip() and not line.startswith("   "):
                in_automodule = False

            # Clean up text outside automodule blocks
            if not in_automodule:
                if "Submodules " in line:
                    continue 
                if "Subpackages " in line:
                    line = line.replace("Subpackages", "")
                if "package " in line:
                    line = line.replace("package", "")
                if "module " in line:
                    line = line.replace("module", "")

            processed.append(line)
        source[0] = "\n".join(processed)


def skip_member(app, what, name, obj, skip, options):
    """
    Exclude members not explicitly listed in INCLUDE_MEMBERS from the documentation.
    """

    # module_name = obj.__module__ if hasattr(obj, '__module__') else ''
    # class_name = obj.__class__.__name__ if hasattr(obj, '__class__') else ''
    # member_name = name.split('.')[-1]

    # if module_name in INCLUDE_MEMBERS:
    #     if class_name in INCLUDE_MEMBERS[module_name]:
    #         return member_name not in INCLUDE_MEMBERS[module_name][class_name]
    #     return True
    # return True
    
    if name == "__init__":
        return True
    if name.startswith("_"):
        return True
    if what == "attribute":
        return True
    return False
