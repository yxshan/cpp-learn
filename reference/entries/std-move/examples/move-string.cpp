#include <iostream>
#include <string>
#include <utility>

int main() {
    std::string source{"C++"};
    std::string target = std::move(source);
    std::cout << target << '\n';
}
