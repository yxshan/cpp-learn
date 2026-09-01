#include <filesystem>
#include <iostream>

int main() {
    const std::filesystem::path path{"docs/reference/vector.md"};
    std::cout << "parent=" << path.parent_path().generic_string() << '\n';
    std::cout << "filename=" << path.filename().generic_string() << '\n';
    std::cout << "stem=" << path.stem().generic_string() << '\n';
    std::cout << "extension=" << path.extension().generic_string() << '\n';
}
