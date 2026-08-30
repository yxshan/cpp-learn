#include <iostream>
#include <string>

int main() {
    std::string service = "api";
    service.append(service.data(), service.size());
    std::cout << service << '\n';
}
